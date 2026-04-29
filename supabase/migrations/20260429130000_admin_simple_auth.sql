-- =====================================================================
-- Migration: simplificação do admin (projeto pra amigos, não precisa de
-- bcrypt/sessões/headers).
--
-- Estratégia:
--   • Tabela admin_credentials guarda senha PLAIN (sem hash) — sem
--     pgcrypto, sem complicação
--   • Cada RPC admin_* recebe `p_admin_password` como primeiro parâmetro
--     e valida internamente via _admin_pw_ok(p)
--   • Sem tokens, sem sessões, sem headers customizados — cliente passa
--     a senha em cada chamada
--   • Cliente armazena a senha em sessionStorage (só pra evitar pedir
--     toda vez)
--
-- IMPORTANTE: senha trafega em texto puro nas requisições. Para um jogo
-- entre amigos é aceitável; HTTPS já criptografa em trânsito.
-- =====================================================================

BEGIN;

-- ── 1. Limpeza das estruturas antigas (idempotente) ──────────────
DROP FUNCTION IF EXISTS public.admin_login(text, text);
DROP FUNCTION IF EXISTS public.admin_logout(uuid);
DROP FUNCTION IF EXISTS public.verify_admin_password(text);
DROP FUNCTION IF EXISTS public.admin_setup_initial(text, text);
DROP TABLE     IF EXISTS public.admin_sessions;
-- admin_users não é usado mais, mas mantemos pra não quebrar referências
-- de migrations antigas. Pode ser dropado manualmente depois.

-- ── 2. Tabela admin_credentials (senha plain) ─────────────────────
-- Recriamos do zero pra remover password_hash/last_login_at antigos
DROP TABLE IF EXISTS public.admin_credentials CASCADE;

CREATE TABLE public.admin_credentials (
  username    text PRIMARY KEY,
  password    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;
-- Sem políticas SELECT — só RPCs SECURITY DEFINER acessam.

-- Bootstrap: insere senha padrão
INSERT INTO public.admin_credentials (username, password)
  VALUES ('alife', 'alife1219!')
  ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password;

-- ── 3. Validador interno ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._admin_pw_ok(p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF p_password IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.admin_credentials WHERE password = p_password
  );
END;
$$;

-- Refatoramos is_admin() pra usar o validador via header (compat) OU
-- sempre retornar false. Como vamos passar a senha em cada RPC,
-- is_admin() vira só um helper opcional.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN false; -- legado: sem auth.uid() em admin_users; usa _admin_pw_ok
END;
$$;

GRANT EXECUTE ON FUNCTION public._admin_pw_ok(text) TO anon, authenticated;

-- ── 4. RPC pública: admin_check_password ──────────────────────────
-- Cliente chama uma vez no login pra confirmar a senha antes de gravar
-- em sessionStorage.
CREATE OR REPLACE FUNCTION public.admin_check_password(p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN public._admin_pw_ok(p_password);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_check_password(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_check_password(text) TO anon, authenticated;

-- =====================================================================
-- 5. Recria todas as RPCs admin_* com `p_admin_password` no início
-- =====================================================================

-- ── admin_log_error (segue público; logger não precisa de senha) ──
-- (mantém versão original em 20260429100000)

-- ── admin_list_error_logs ─────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_list_error_logs(int, text, timestamptz);

CREATE OR REPLACE FUNCTION public.admin_list_error_logs(
  p_admin_password text,
  p_limit          int DEFAULT 100,
  p_function_name  text DEFAULT NULL,
  p_since          timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id             bigint,
  user_id        uuid,
  user_email     text,
  function_name  text,
  error_message  text,
  error_code     text,
  payload        jsonb,
  created_at     timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._admin_pw_ok(p_admin_password) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;

  RETURN QUERY
    SELECT
      l.id,
      l.user_id,
      u.email::text  AS user_email,
      l.function_name,
      l.error_message,
      l.error_code,
      l.payload,
      l.created_at
    FROM public.admin_error_logs l
    LEFT JOIN auth.users u ON u.id = l.user_id
    WHERE (p_function_name IS NULL OR l.function_name = p_function_name)
      AND (p_since IS NULL OR l.created_at >= p_since)
    ORDER BY l.created_at DESC
    LIMIT GREATEST(LEAST(p_limit, 1000), 1);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_error_logs(text, int, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_error_logs(text, int, text, timestamptz) TO anon, authenticated;

-- ── admin_clear_error_logs ────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_clear_error_logs(int);

CREATE OR REPLACE FUNCTION public.admin_clear_error_logs(
  p_admin_password text,
  p_older_than_days int DEFAULT 30
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_deleted int;
BEGIN
  IF NOT public._admin_pw_ok(p_admin_password) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM public.admin_error_logs
    WHERE created_at < now() - (p_older_than_days || ' days')::interval;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_clear_error_logs(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_clear_error_logs(text, int) TO anon, authenticated;

-- ── admin_set_player_money ────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_set_player_money(uuid, numeric);

CREATE OR REPLACE FUNCTION public.admin_set_player_money(
  p_admin_password text,
  p_target_user_id uuid,
  p_new_money      numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._admin_pw_ok(p_admin_password) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.game_progress WHERE user_id = p_target_user_id FOR UPDATE) THEN
    RAISE EXCEPTION 'target_not_found' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.game_progress
    SET money         = p_new_money,
        car_game_data = CASE
          WHEN car_game_data IS NULL THEN jsonb_build_object('money', p_new_money)
          ELSE jsonb_set(car_game_data, '{money}', to_jsonb(p_new_money))
        END,
        updated_at    = now()
    WHERE user_id = p_target_user_id;

  RETURN p_new_money;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_player_money(text, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_player_money(text, uuid, numeric) TO anon, authenticated;

-- ── admin_adjust_player_money ─────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_adjust_player_money(uuid, numeric);

CREATE OR REPLACE FUNCTION public.admin_adjust_player_money(
  p_admin_password text,
  p_target_user_id uuid,
  p_delta          numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_new numeric; v_current numeric;
BEGIN
  IF NOT public._admin_pw_ok(p_admin_password) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;
  SELECT money INTO v_current FROM public.game_progress
    WHERE user_id = p_target_user_id FOR UPDATE;
  IF v_current IS NULL THEN
    RAISE EXCEPTION 'target_not_found' USING ERRCODE = 'P0001';
  END IF;
  v_new := v_current + p_delta;
  UPDATE public.game_progress
    SET money         = v_new,
        car_game_data = CASE
          WHEN car_game_data IS NULL THEN jsonb_build_object('money', v_new)
          ELSE jsonb_set(car_game_data, '{money}', to_jsonb(v_new))
        END,
        updated_at    = now()
    WHERE user_id = p_target_user_id;
  RETURN v_new;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_adjust_player_money(text, uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_adjust_player_money(text, uuid, numeric) TO anon, authenticated;

-- ── admin_create_car ──────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_create_car(text, text, text, text, text, jsonb, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.admin_create_car(
  p_admin_password text,
  p_id        text,
  p_brand     text,
  p_model     text,
  p_icon      text,
  p_category  text,
  p_variants  jsonb,
  p_wiki_pt   text DEFAULT NULL,
  p_wiki_en   text DEFAULT NULL,
  p_image_urls jsonb DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._admin_pw_ok(p_admin_password) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;
  IF p_id IS NULL OR length(trim(p_id)) = 0 THEN
    RAISE EXCEPTION 'invalid_id' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_variants) <> 'array' OR jsonb_array_length(p_variants) = 0 THEN
    RAISE EXCEPTION 'variants_required' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.admin_custom_cars
    (id, brand, model, icon, category, variants, wiki_pt, wiki_en, image_urls, created_by)
    VALUES (p_id, p_brand, p_model, p_icon, p_category, p_variants, p_wiki_pt, p_wiki_en, p_image_urls, auth.uid())
    ON CONFLICT (id) DO UPDATE SET
      brand      = EXCLUDED.brand,
      model      = EXCLUDED.model,
      icon       = EXCLUDED.icon,
      category   = EXCLUDED.category,
      variants   = EXCLUDED.variants,
      wiki_pt    = EXCLUDED.wiki_pt,
      wiki_en    = EXCLUDED.wiki_en,
      image_urls = EXCLUDED.image_urls;
  RETURN p_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_create_car(text, text, text, text, text, text, jsonb, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_car(text, text, text, text, text, text, jsonb, text, text, jsonb) TO anon, authenticated;

-- ── admin_delete_car ──────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_delete_car(text);

CREATE OR REPLACE FUNCTION public.admin_delete_car(
  p_admin_password text,
  p_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._admin_pw_ok(p_admin_password) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.admin_custom_cars SET active = false WHERE id = p_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_car(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_car(text, text) TO anon, authenticated;

-- ── admin_update_full_market_config ──────────────────────────────
DROP FUNCTION IF EXISTS public.admin_update_full_market_config(jsonb, int, int, numeric, int);
DROP FUNCTION IF EXISTS public.admin_update_market_config(jsonb);

CREATE OR REPLACE FUNCTION public.admin_update_full_market_config(
  p_admin_password    text,
  p_weights           jsonb,
  p_min_batch         int,
  p_max_batch         int,
  p_popular_min_ratio numeric DEFAULT NULL,
  p_max_same_model    int     DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_total numeric;
BEGIN
  IF NOT public._admin_pw_ok(p_admin_password) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_weights) <> 'object' THEN
    RAISE EXCEPTION 'weights_must_be_object' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(SUM((value)::numeric), 0) INTO v_total FROM jsonb_each_text(p_weights);
  IF v_total < 99 OR v_total > 101 THEN
    RAISE EXCEPTION 'weights_must_sum_to_100 (got %)', v_total USING ERRCODE = 'P0001';
  END IF;
  IF p_min_batch <= 0 OR p_min_batch > p_max_batch OR p_max_batch > 5000 THEN
    RAISE EXCEPTION 'invalid_batch_range' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.admin_market_config
    SET category_weights  = p_weights,
        min_batch         = p_min_batch,
        max_batch         = p_max_batch,
        popular_min_ratio = COALESCE(p_popular_min_ratio, popular_min_ratio),
        max_same_model    = COALESCE(p_max_same_model,    max_same_model),
        updated_at        = now(),
        updated_by        = auth.uid()
    WHERE id = 1;

  RETURN public.get_full_market_config();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_full_market_config(text, jsonb, int, int, numeric, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_full_market_config(text, jsonb, int, int, numeric, int) TO anon, authenticated;

-- ── admin_clear_marketplace ──────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_clear_marketplace();

CREATE OR REPLACE FUNCTION public.admin_clear_marketplace(p_admin_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_deleted int; v_new_batch bigint;
BEGIN
  IF NOT public._admin_pw_ok(p_admin_password) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM public.marketplace_global WHERE status = 'available';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  UPDATE public.marketplace_meta
    SET batch_id = COALESCE(batch_id, 0) + 1, last_refresh = NULL
    WHERE id = 1
    RETURNING batch_id INTO v_new_batch;
  RETURN jsonb_build_object('deleted', v_deleted, 'new_batch_id', COALESCE(v_new_batch, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_clear_marketplace(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_clear_marketplace(text) TO anon, authenticated;

-- ── admin_force_market_refresh ───────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_force_market_refresh();

CREATE OR REPLACE FUNCTION public.admin_force_market_refresh(p_admin_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._admin_pw_ok(p_admin_password) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.marketplace_meta SET last_refresh = NULL WHERE id = 1;
  RETURN jsonb_build_object('reset', true);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_force_market_refresh(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_force_market_refresh(text) TO anon, authenticated;

-- ── admin_get_market_overview ────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_get_market_overview();

CREATE OR REPLACE FUNCTION public.admin_get_market_overview(p_admin_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta            public.marketplace_meta;
  v_total           int;
  v_available       int;
  v_sold            int;
  v_by_cat          jsonb;
  v_cooldown_secs   int := 6 * 60 * 60;
BEGIN
  IF NOT public._admin_pw_ok(p_admin_password) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_meta FROM public.marketplace_meta WHERE id = 1;
  SELECT COUNT(*)                                   INTO v_total      FROM public.marketplace_global;
  SELECT COUNT(*) FILTER (WHERE status = 'available') INTO v_available FROM public.marketplace_global;
  SELECT COUNT(*) FILTER (WHERE status = 'sold')      INTO v_sold      FROM public.marketplace_global;
  SELECT jsonb_object_agg(category, c) INTO v_by_cat FROM (
    SELECT category, COUNT(*) AS c
      FROM public.marketplace_global
      WHERE status = 'available'
      GROUP BY category
  ) t;
  RETURN jsonb_build_object(
    'last_refresh',     v_meta.last_refresh,
    'next_refresh_at',  CASE WHEN v_meta.last_refresh IS NULL THEN now()
                              ELSE v_meta.last_refresh + (v_cooldown_secs || ' seconds')::interval END,
    'batch_id',         v_meta.batch_id,
    'total_cars',       COALESCE(v_total, 0),
    'available_cars',   COALESCE(v_available, 0),
    'sold_cars',        COALESCE(v_sold, 0),
    'by_category',      COALESCE(v_by_cat, '{}'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_market_overview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_market_overview(text) TO anon, authenticated;

-- ── admin_list_players ───────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_list_players(text, int);

CREATE OR REPLACE FUNCTION public.admin_list_players(
  p_admin_password text,
  p_search         text DEFAULT NULL,
  p_limit          int  DEFAULT 200
)
RETURNS TABLE (
  user_id        uuid,
  email          text,
  display_name   text,
  level          int,
  total_patrimony numeric,
  money          numeric,
  races_won      int,
  updated_at     timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public._admin_pw_ok(p_admin_password) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;
  RETURN QUERY
    SELECT
      p.user_id,
      u.email::text          AS email,
      p.display_name,
      p.level,
      p.total_patrimony,
      gp.money,
      COALESCE(p.races_won, 0),
      p.updated_at
    FROM public.player_profiles p
    LEFT JOIN auth.users u ON u.id = p.user_id
    LEFT JOIN public.game_progress gp ON gp.user_id = p.user_id
    WHERE (p_search IS NULL OR
           p.display_name ILIKE '%' || p_search || '%' OR
           u.email ILIKE '%' || p_search || '%')
    ORDER BY p.total_patrimony DESC NULLS LAST
    LIMIT GREATEST(LEAST(p_limit, 1000), 1);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_players(text, text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_players(text, text, int) TO anon, authenticated;

-- ── admin_list_duplicate_accounts ────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_list_duplicate_accounts();

CREATE OR REPLACE FUNCTION public.admin_list_duplicate_accounts(p_admin_password text)
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
  IF NOT public._admin_pw_ok(p_admin_password) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;

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

  RETURN QUERY
    SELECT 'orphan_profile'::text, p.display_name::text, 1::int, p.user_id, p.user_id
    FROM public.player_profiles p
    WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id);

  RETURN QUERY
    SELECT 'orphan_progress'::text, g.user_id::text, 1::int, g.user_id, g.user_id
    FROM public.game_progress g
    WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = g.user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_duplicate_accounts(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_duplicate_accounts(text) TO anon, authenticated;

-- ── admin_dedupe_accounts ────────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_dedupe_accounts();

CREATE OR REPLACE FUNCTION public.admin_dedupe_accounts(p_admin_password text)
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
  IF NOT public._admin_pw_ok(p_admin_password) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;

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
      SELECT MAX(money) INTO v_max_money FROM public.game_progress
        WHERE user_id = v_keep_id OR user_id = ANY(v_kill_ids);
      SELECT MAX(total_patrimony) INTO v_max_patrimony FROM public.player_profiles
        WHERE user_id = v_keep_id OR user_id = ANY(v_kill_ids);

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

      DELETE FROM auth.users WHERE id = ANY(v_kill_ids);
      v_users_deleted := v_users_deleted + array_length(v_kill_ids, 1);
      v_emails_processed := v_emails_processed + 1;
    END IF;
  END LOOP;

  DELETE FROM public.player_profiles
    WHERE user_id NOT IN (SELECT id FROM auth.users);
  GET DIAGNOSTICS v_orphan_profiles = ROW_COUNT;

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

REVOKE ALL ON FUNCTION public.admin_dedupe_accounts(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_dedupe_accounts(text) TO anon, authenticated;

-- Recarrega schema do PostgREST
NOTIFY pgrst, 'reload schema';

COMMIT;

-- =====================================================================
-- Para trocar a senha admin no futuro:
--   UPDATE public.admin_credentials
--     SET password = 'NOVA_SENHA' WHERE username = 'alife';
-- =====================================================================
