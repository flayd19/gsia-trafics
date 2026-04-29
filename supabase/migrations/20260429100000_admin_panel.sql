-- =====================================================================
-- Migration: Painel administrativo do jogo
--
-- Componentes:
--   • admin_users          — quem tem acesso (user_id + bcrypt password hash)
--   • admin_error_logs     — registro de falhas RPC capturadas no client
--   • admin_custom_cars    — carros adicionados pelo admin via UI
--   • admin_market_config  — pesos % por categoria do mercado global
--   • RPCs:
--       verify_admin_password(p)  — valida senha, retorna boolean
--       is_admin()                — retorna boolean para uid atual
--       admin_log_error(...)      — qualquer authenticated insere
--       admin_set_player_money    — só admin
--       admin_adjust_player_money — só admin
--       admin_create_car          — só admin
--       admin_delete_car          — só admin
--       admin_update_market_config — só admin
--       admin_get_market_overview — só admin
--       admin_force_market_refresh — só admin (bypass cooldown 6h)
--       admin_list_error_logs     — só admin
--       admin_clear_error_logs    — só admin
--       admin_setup_initial       — bootstrap único
--
-- Setup inicial (rodar UMA VEZ no SQL Editor após aplicar a migração):
--   SELECT public.admin_setup_initial(
--     'flaidinhoslife.2004@gmail.com',  -- email da sua conta
--     'alife1219!'                        -- senha do painel admin
--   );
-- =====================================================================

BEGIN;

-- pgcrypto para bcrypt (crypt + gen_salt)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── Tabela: admin_users ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_users (
  user_id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  password_hash  text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  last_login_at  timestamptz
);

ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
-- Nenhuma policy de SELECT direta — SOMENTE RPCs SECURITY DEFINER acessam.

-- ── Tabela: admin_error_logs ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_error_logs (
  id             bigserial PRIMARY KEY,
  user_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  function_name  text NOT NULL,
  error_message  text NOT NULL,
  error_code     text,
  payload        jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_error_logs_created_at_idx
  ON public.admin_error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_error_logs_function_idx
  ON public.admin_error_logs (function_name, created_at DESC);

ALTER TABLE public.admin_error_logs ENABLE ROW LEVEL SECURITY;
-- INSERT permitido para authenticated via RPC; SELECT somente via RPC admin.

-- ── Tabela: admin_custom_cars ──────────────────────────────────────
-- Carros adicionados pelo admin que entram no catálogo dinâmico junto
-- com CAR_MODELS estáticos.
CREATE TABLE IF NOT EXISTS public.admin_custom_cars (
  id            text PRIMARY KEY,        -- ex: 'civic_si_custom'
  brand         text NOT NULL,
  model         text NOT NULL,
  icon          text NOT NULL,           -- emoji
  category      text NOT NULL CHECK (category IN
    ('popular','medio','suv','pickup','esportivo','eletrico','classico','luxo','jdm','supercar')
  ),
  variants      jsonb NOT NULL,          -- [{id, trim, year, fipePrice}, ...]
  wiki_pt       text,                    -- título do artigo Wikipedia PT (para foto)
  wiki_en       text,                    -- título Wikipedia EN (fallback)
  image_urls    jsonb,                   -- override manual de URLs (se API falhar)
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.admin_custom_cars ENABLE ROW LEVEL SECURITY;

-- Qualquer authenticated pode SELECT (cliente precisa carregar no boot).
DROP POLICY IF EXISTS "anyone reads custom cars" ON public.admin_custom_cars;
CREATE POLICY "anyone reads custom cars" ON public.admin_custom_cars
  FOR SELECT TO authenticated USING (active = true);

-- ── Tabela: admin_market_config ────────────────────────────────────
-- Singleton (id = 1). category_weights é um JSON {category: weightPercent}.
CREATE TABLE IF NOT EXISTS public.admin_market_config (
  id                int PRIMARY KEY DEFAULT 1,
  category_weights  jsonb NOT NULL,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CHECK (id = 1)
);

-- Configuração default: igual à lógica antiga (40% popular + outras divididas)
INSERT INTO public.admin_market_config (id, category_weights)
  VALUES (1, jsonb_build_object(
    'popular',   40,
    'medio',     12,
    'suv',       12,
    'pickup',    10,
    'esportivo', 8,
    'eletrico',  6,
    'jdm',       5,
    'classico',  3,
    'luxo',      3,
    'supercar',  1
  ))
  ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.admin_market_config ENABLE ROW LEVEL SECURITY;
-- SELECT pra todos authenticated; UPDATE só via RPC admin.
DROP POLICY IF EXISTS "anyone reads market config" ON public.admin_market_config;
CREATE POLICY "anyone reads market config" ON public.admin_market_config
  FOR SELECT TO authenticated USING (true);

-- =====================================================================
-- RPCs
-- =====================================================================

-- ── is_admin() ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

-- ── verify_admin_password(p_password) ──────────────────────────────
-- Valida senha contra o hash bcrypt do admin atual. Retorna true se ok.
-- IMPORTANTE: o usuário precisa estar logado com sua conta normal antes;
-- a verify_admin_password apenas valida a senha do PAINEL para o user atual.
CREATE OR REPLACE FUNCTION public.verify_admin_password(p_password text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_uid  uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;

  SELECT password_hash INTO v_hash
    FROM public.admin_users
    WHERE user_id = v_uid;

  IF v_hash IS NULL THEN RETURN false; END IF;

  IF crypt(p_password, v_hash) = v_hash THEN
    UPDATE public.admin_users
      SET last_login_at = now()
      WHERE user_id = v_uid;
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.verify_admin_password(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_admin_password(text) TO authenticated;

-- ── admin_setup_initial(email, password) ───────────────────────────
-- Bootstrap: insere o primeiro admin se a tabela admin_users estiver vazia.
-- Após o primeiro admin existir, retorna erro.
CREATE OR REPLACE FUNCTION public.admin_setup_initial(p_email text, p_password text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.admin_users LIMIT 1) THEN
    RAISE EXCEPTION 'admin_already_exists' USING ERRCODE = 'P0001';
  END IF;

  SELECT id INTO v_uid FROM auth.users WHERE email = p_email LIMIT 1;
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'user_not_found_for_email: %', p_email USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.admin_users (user_id, password_hash)
    VALUES (v_uid, crypt(p_password, gen_salt('bf')));

  RETURN v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_setup_initial(text, text) FROM PUBLIC;
-- NÃO grant a authenticated — só pode ser chamado via SQL Editor do Supabase.

-- ── admin_log_error ────────────────────────────────────────────────
-- Qualquer authenticated pode logar; RLS limita SELECT.
CREATE OR REPLACE FUNCTION public.admin_log_error(
  p_function_name text,
  p_error_message text,
  p_error_code    text DEFAULT NULL,
  p_payload       jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.admin_error_logs (user_id, function_name, error_message, error_code, payload)
    VALUES (auth.uid(), p_function_name, LEFT(p_error_message, 1000), p_error_code, p_payload);
EXCEPTION WHEN OTHERS THEN
  -- Não propaga erro de log: silencia para não quebrar o caller
  NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_log_error(text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_log_error(text, text, text, jsonb) TO authenticated;

-- ── admin_list_error_logs ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_error_logs(
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
  IF NOT public.is_admin() THEN
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

REVOKE ALL ON FUNCTION public.admin_list_error_logs(int, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_error_logs(int, text, timestamptz) TO authenticated;

-- ── admin_clear_error_logs ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_clear_error_logs(p_older_than_days int DEFAULT 30)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM public.admin_error_logs
    WHERE created_at < now() - (p_older_than_days || ' days')::interval;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_clear_error_logs(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_clear_error_logs(int) TO authenticated;

-- ── admin_set_player_money / admin_adjust_player_money ─────────────
CREATE OR REPLACE FUNCTION public.admin_set_player_money(
  p_target_user_id uuid,
  p_new_money      numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jsonb_money numeric;
BEGIN
  IF NOT public.is_admin() THEN
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

REVOKE ALL ON FUNCTION public.admin_set_player_money(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_player_money(uuid, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_adjust_player_money(
  p_target_user_id uuid,
  p_delta          numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new numeric;
  v_current numeric;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;

  SELECT money INTO v_current
    FROM public.game_progress WHERE user_id = p_target_user_id FOR UPDATE;
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

REVOKE ALL ON FUNCTION public.admin_adjust_player_money(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_adjust_player_money(uuid, numeric) TO authenticated;

-- ── admin_create_car / admin_delete_car ────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_create_car(
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
  IF NOT public.is_admin() THEN
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

REVOKE ALL ON FUNCTION public.admin_create_car(text, text, text, text, text, jsonb, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_create_car(text, text, text, text, text, jsonb, text, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_delete_car(p_id text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;
  -- Soft delete (mantém histórico)
  UPDATE public.admin_custom_cars SET active = false WHERE id = p_id;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_car(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_car(text) TO authenticated;

-- ── admin_update_market_config ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_update_market_config(p_weights jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_weights) <> 'object' THEN
    RAISE EXCEPTION 'weights_must_be_object' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.admin_market_config
    SET category_weights = p_weights,
        updated_at       = now(),
        updated_by       = auth.uid()
    WHERE id = 1;

  RETURN p_weights;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_market_config(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_market_config(jsonb) TO authenticated;

-- ── admin_get_market_overview ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_get_market_overview()
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
  IF NOT public.is_admin() THEN
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

REVOKE ALL ON FUNCTION public.admin_get_market_overview() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_market_overview() TO authenticated;

-- ── admin_force_market_refresh ─────────────────────────────────────
-- Reseta last_refresh para NULL, permitindo o cliente popular novo batch
-- imediatamente via populate_marketplace_batch (que valida cooldown).
CREATE OR REPLACE FUNCTION public.admin_force_market_refresh()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.marketplace_meta SET last_refresh = NULL WHERE id = 1;

  RETURN jsonb_build_object(
    'reset', true,
    'next_action', 'cliente irá popular novo batch no próximo loadMarketplace'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_force_market_refresh() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_force_market_refresh() TO authenticated;

-- ── admin_list_players ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_list_players(p_search text DEFAULT NULL, p_limit int DEFAULT 200)
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
  IF NOT public.is_admin() THEN
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

REVOKE ALL ON FUNCTION public.admin_list_players(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_players(text, int) TO authenticated;

COMMIT;

-- =====================================================================
-- BOOTSTRAP MANUAL (rodar separadamente após aplicar a migração):
--
--   SELECT public.admin_setup_initial(
--     'flaidinhoslife.2004@gmail.com',
--     'alife1219!'
--   );
-- =====================================================================
