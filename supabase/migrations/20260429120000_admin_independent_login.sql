-- =====================================================================
-- Migration: login admin INDEPENDENTE do login do jogo + cleanup de
-- contas duplicadas.
--
-- Antes: verify_admin_password validava SENHA mas exigia que o usuário
-- já estivesse autenticado com sua conta normal (auth.uid()). Isso
-- forçava login duplo e era confuso.
--
-- Agora:
--   • Tabela admin_credentials (username/password_hash, sem vínculo
--     com auth.users)
--   • RPC admin_login(username, password) é ANÔNIMA — retorna um token
--     UUID que vale 8 h
--   • Tabela admin_sessions guarda os tokens válidos
--   • Cliente envia o token via header x-admin-token em toda chamada
--   • is_admin() é refatorada para aceitar:
--       (a) auth.uid() em admin_users  (caminho legado)
--       (b) header x-admin-token presente em admin_sessions  (novo)
--
-- Cleanup de contas:
--   • admin_list_duplicate_accounts() — lista emails com múltiplas linhas
--   • admin_dedupe_accounts() — remove contas duplicadas (mantém a mais
--     antiga) + limpa player_profiles/game_progress órfãos
-- =====================================================================

BEGIN;

-- ── Tabela: admin_credentials ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_credentials (
  username       text PRIMARY KEY,
  password_hash  text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_login_at  timestamptz
);

ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;
-- Sem políticas de SELECT — só RPCs SECURITY DEFINER acessam.

-- Bootstrap: insere credencial padrão se ainda não houver nenhuma
INSERT INTO public.admin_credentials (username, password_hash)
  VALUES ('alife', crypt('alife1219!', gen_salt('bf')))
  ON CONFLICT (username) DO NOTHING;

-- ── Tabela: admin_sessions ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  token       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username    text NOT NULL REFERENCES public.admin_credentials(username) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_sessions_expires_idx
  ON public.admin_sessions (expires_at);

ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;

-- ── RPC: admin_login (ANÔNIMA — não exige auth.uid()) ─────────────
CREATE OR REPLACE FUNCTION public.admin_login(
  p_username text,
  p_password text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash  text;
  v_token uuid;
BEGIN
  IF p_username IS NULL OR p_password IS NULL THEN
    RAISE EXCEPTION 'invalid_credentials' USING ERRCODE = 'P0001';
  END IF;

  SELECT password_hash INTO v_hash
    FROM public.admin_credentials
    WHERE username = p_username;

  IF v_hash IS NULL OR crypt(p_password, v_hash) <> v_hash THEN
    -- Pequeno delay como mitigação anti-bruteforce (não bloqueia outros
    -- conexões, apenas atrasa a resposta dessa request)
    PERFORM pg_sleep(1);
    RAISE EXCEPTION 'invalid_credentials' USING ERRCODE = 'P0001';
  END IF;

  -- Limpa sessões expiradas (housekeeping)
  DELETE FROM public.admin_sessions WHERE expires_at < now();

  INSERT INTO public.admin_sessions (username, expires_at)
    VALUES (p_username, now() + interval '8 hours')
    RETURNING token INTO v_token;

  UPDATE public.admin_credentials
    SET last_login_at = now()
    WHERE username = p_username;

  RETURN jsonb_build_object(
    'token',      v_token::text,
    'expires_at', (now() + interval '8 hours')::text
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_login(text, text) FROM PUBLIC;
-- Concedido para anon E authenticated — qualquer um pode TENTAR logar
GRANT EXECUTE ON FUNCTION public.admin_login(text, text) TO anon, authenticated;

-- ── RPC: admin_logout ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_logout(p_token uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.admin_sessions WHERE token = p_token;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_logout(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_logout(uuid) TO anon, authenticated;

-- ── Refatora is_admin() para aceitar token via header ─────────────
-- Caminho 1 (legado): auth.uid() em admin_users
-- Caminho 2 (novo):   header x-admin-token presente em admin_sessions
-- Caminho 3 (defesa): variável de sessão set_config('app.admin_token', ...)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_token_text text;
  v_token      uuid;
BEGIN
  -- Caminho 1: usuário Supabase autenticado em admin_users
  IF auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
  ) THEN
    RETURN true;
  END IF;

  -- Caminho 2: header HTTP x-admin-token
  BEGIN
    v_token_text := nullif(
      current_setting('request.headers', true), ''
    )::json->>'x-admin-token';
  EXCEPTION WHEN OTHERS THEN
    v_token_text := NULL;
  END;

  IF v_token_text IS NULL OR v_token_text = '' THEN
    RETURN false;
  END IF;

  BEGIN
    v_token := v_token_text::uuid;
  EXCEPTION WHEN OTHERS THEN
    RETURN false;
  END;

  RETURN EXISTS (
    SELECT 1 FROM public.admin_sessions
    WHERE token = v_token AND expires_at > now()
  );
END;
$$;

-- Mantém grants existentes
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- =====================================================================
-- DEDUPE de contas duplicadas + cleanup de órfãos
-- =====================================================================

-- ── RPC: admin_list_duplicate_accounts ────────────────────────────
-- Lista emails com múltiplas linhas em auth.users + perfis/progresso
-- órfãos (sem auth.users correspondente).
CREATE OR REPLACE FUNCTION public.admin_list_duplicate_accounts()
RETURNS TABLE (
  category        text,
  email           text,
  count           int,
  oldest_user_id  uuid,
  newest_user_id  uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;

  -- Emails duplicados em auth.users
  RETURN QUERY
    SELECT
      'duplicate_email'::text                          AS category,
      u.email::text                                    AS email,
      COUNT(*)::int                                    AS count,
      (array_agg(u.id ORDER BY u.created_at ASC))[1]   AS oldest_user_id,
      (array_agg(u.id ORDER BY u.created_at DESC))[1]  AS newest_user_id
    FROM auth.users u
    WHERE u.email IS NOT NULL
    GROUP BY u.email
    HAVING COUNT(*) > 1;

  -- Player_profiles órfãos (sem auth.users)
  RETURN QUERY
    SELECT
      'orphan_profile'::text  AS category,
      p.display_name::text    AS email,
      1::int                  AS count,
      p.user_id               AS oldest_user_id,
      p.user_id               AS newest_user_id
    FROM public.player_profiles p
    WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id);

  -- Game_progress órfão (sem auth.users)
  RETURN QUERY
    SELECT
      'orphan_progress'::text AS category,
      g.user_id::text         AS email,
      1::int                  AS count,
      g.user_id               AS oldest_user_id,
      g.user_id               AS newest_user_id
    FROM public.game_progress g
    WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = g.user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_duplicate_accounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_duplicate_accounts() TO anon, authenticated;

-- ── RPC: admin_dedupe_accounts ────────────────────────────────────
-- Estratégia:
--   1. Para cada email com múltiplas linhas em auth.users, mantém a
--      MAIS ANTIGA. As outras são deletadas (cascade limpa profile/
--      progress). Para a conta antiga MERGE patrimony tomando o maior
--      saldo entre as duplicatas.
--   2. Limpa player_profiles e game_progress sem auth.users
--      correspondente.
--
-- Retorna contagem das operações.
CREATE OR REPLACE FUNCTION public.admin_dedupe_accounts()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email             text;
  v_keep_id           uuid;
  v_kill_ids          uuid[];
  v_max_money         numeric;
  v_max_patrimony     numeric;
  v_emails_processed  int := 0;
  v_users_deleted     int := 0;
  v_orphan_profiles   int;
  v_orphan_progress   int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;

  -- 1. Para cada email duplicado:
  --    a. Acha a conta mais antiga (KEEP)
  --    b. Acha as demais (KILL)
  --    c. Move o maior saldo para a KEEP antes de deletar as KILLs
  FOR v_email IN
    SELECT email FROM auth.users
      WHERE email IS NOT NULL
      GROUP BY email HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO v_keep_id FROM auth.users
      WHERE email = v_email
      ORDER BY created_at ASC
      LIMIT 1;

    SELECT array_agg(id) INTO v_kill_ids FROM auth.users
      WHERE email = v_email AND id <> v_keep_id;

    IF v_keep_id IS NOT NULL AND v_kill_ids IS NOT NULL THEN
      -- Mescla saldo: pega o maior money entre todas as duplicatas
      SELECT MAX(money) INTO v_max_money FROM public.game_progress
        WHERE user_id = v_keep_id OR user_id = ANY(v_kill_ids);

      -- Mescla patrimônio: maior valor entre as duplicatas
      SELECT MAX(total_patrimony) INTO v_max_patrimony FROM public.player_profiles
        WHERE user_id = v_keep_id OR user_id = ANY(v_kill_ids);

      -- Atualiza conta KEEP com os melhores valores
      IF v_max_money IS NOT NULL THEN
        UPDATE public.game_progress
          SET money = v_max_money, updated_at = now()
          WHERE user_id = v_keep_id;
      END IF;
      IF v_max_patrimony IS NOT NULL THEN
        UPDATE public.player_profiles
          SET total_patrimony = v_max_patrimony, updated_at = now()
          WHERE user_id = v_keep_id;
      END IF;

      -- Deleta as KILLs (CASCADE remove profile/progress dela)
      DELETE FROM auth.users WHERE id = ANY(v_kill_ids);
      v_users_deleted := v_users_deleted + array_length(v_kill_ids, 1);
      v_emails_processed := v_emails_processed + 1;
    END IF;
  END LOOP;

  -- 2. Limpa player_profiles órfãos
  DELETE FROM public.player_profiles
    WHERE user_id NOT IN (SELECT id FROM auth.users);
  GET DIAGNOSTICS v_orphan_profiles = ROW_COUNT;

  -- 3. Limpa game_progress órfãos
  DELETE FROM public.game_progress
    WHERE user_id NOT IN (SELECT id FROM auth.users);
  GET DIAGNOSTICS v_orphan_progress = ROW_COUNT;

  RETURN jsonb_build_object(
    'emails_processed',         v_emails_processed,
    'duplicate_users_deleted',  v_users_deleted,
    'orphan_profiles_deleted',  v_orphan_profiles,
    'orphan_progress_deleted',  v_orphan_progress
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_dedupe_accounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_dedupe_accounts() TO anon, authenticated;

COMMIT;

-- =====================================================================
-- BOOTSTRAP MANUAL (se quiser trocar a senha admin):
--
--   UPDATE public.admin_credentials
--     SET password_hash = crypt('NOVA_SENHA_AQUI', gen_salt('bf'))
--     WHERE username = 'alife';
--
-- =====================================================================
