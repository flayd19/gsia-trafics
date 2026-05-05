-- =====================================================================
-- FRESH START — backend do GSIA Construtora (Goianésia Flow)
--
-- Este script consolida TUDO o que o jogo precisa em um projeto Supabase
-- VAZIO. Não depende de nenhuma migration anterior — pode ser rodado em
-- um projeto recém-criado e o backend fica funcional na hora.
--
-- Componentes:
--   1. player_profiles + game_progress (tabelas-base)
--   2. Trigger handle_new_user (cria perfil + progresso no signup)
--   3. RLS policies para auto-leitura/escrita do próprio jogador
--   4. Chat: chat_messages + RPCs (texto/dinheiro/carros)
--   5. Admin: admin_credentials + RPCs (auth simples por senha)
--   6. Cidade: city_blocks + city_lots + RPCs (compra/venda/construção)
--
-- Como rodar:
--   1. Crie um novo projeto em supabase.com
--   2. Vá em "SQL Editor" → "New query"
--   3. Cole este arquivo INTEIRO
--   4. Clique "Run"
--   5. Ao final, rode o bloco BOOTSTRAP MANUAL (no fim deste arquivo)
--      para definir a senha admin
--
-- Depois disso, pegue VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY do
-- painel do projeto e atualize .env.local (e variáveis no Vercel/Netlify
-- se for deploy).
-- =====================================================================

BEGIN;

-- =====================================================================
-- 1. TABELAS BASE
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.player_profiles (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  display_name    text NOT NULL,
  total_patrimony numeric DEFAULT 0,
  level           int     DEFAULT 1,
  races_won       int     DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS player_profiles_patrimony_idx
  ON public.player_profiles (total_patrimony DESC);

CREATE TABLE IF NOT EXISTS public.game_progress (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  money           numeric NOT NULL DEFAULT 50000,
  car_game_data   jsonb DEFAULT NULL,    -- mantido como genérico p/ saves do construtora
  updated_at      timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS game_progress_user_id_idx
  ON public.game_progress (user_id);

-- =====================================================================
-- 2. TRIGGER: cria perfil + progresso ao novo signup
-- =====================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  v_name := COALESCE(
    NULLIF(trim(NEW.raw_user_meta_data->>'display_name'), ''),
    NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
    split_part(NEW.email, '@', 1),
    'Jogador'
  );

  INSERT INTO public.player_profiles (user_id, display_name)
    VALUES (NEW.id, v_name)
    ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.game_progress (user_id, money)
    VALUES (NEW.id, 50000)
    ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- 3. RLS PARA player_profiles + game_progress
-- =====================================================================

ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone reads profiles" ON public.player_profiles;
CREATE POLICY "anyone reads profiles" ON public.player_profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "user updates own profile" ON public.player_profiles;
CREATE POLICY "user updates own profile" ON public.player_profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user inserts own profile" ON public.player_profiles;
CREATE POLICY "user inserts own profile" ON public.player_profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.game_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user reads own progress" ON public.game_progress;
CREATE POLICY "user reads own progress" ON public.game_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user updates own progress" ON public.game_progress;
CREATE POLICY "user updates own progress" ON public.game_progress
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user inserts own progress" ON public.game_progress;
CREATE POLICY "user inserts own progress" ON public.game_progress
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- =====================================================================
-- 4. CHAT (mensagens + dinheiro + carros)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         text NOT NULL CHECK (type IN ('text', 'money_sent', 'car_sent')),
  content      text,
  payload      jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  read_at      timestamptz
);

CREATE INDEX IF NOT EXISTS chat_messages_pair_idx ON public.chat_messages
  (LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id), created_at DESC);

CREATE INDEX IF NOT EXISTS chat_messages_receiver_idx ON public.chat_messages
  (receiver_id, created_at DESC) WHERE read_at IS NULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users see own chat messages" ON public.chat_messages;
CREATE POLICY "users see own chat messages" ON public.chat_messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "users send their own messages" ON public.chat_messages;
CREATE POLICY "users send their own messages" ON public.chat_messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

DROP POLICY IF EXISTS "receivers can mark as read" ON public.chat_messages;
CREATE POLICY "receivers can mark as read" ON public.chat_messages
  FOR UPDATE USING (auth.uid() = receiver_id) WITH CHECK (auth.uid() = receiver_id);

CREATE OR REPLACE FUNCTION public.send_money_to_player(
  p_receiver_id uuid,
  p_amount      numeric,
  p_message     text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_sender_id uuid := auth.uid();
  v_sender_money numeric;
  v_message_id uuid;
BEGIN
  IF v_sender_id IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001'; END IF;
  IF p_amount <= 0 THEN RAISE EXCEPTION 'invalid_amount' USING ERRCODE = 'P0001'; END IF;
  IF v_sender_id = p_receiver_id THEN RAISE EXCEPTION 'cannot_send_to_self' USING ERRCODE = 'P0001'; END IF;
  SELECT money INTO v_sender_money FROM public.game_progress WHERE user_id = v_sender_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'sender_not_found' USING ERRCODE = 'P0001'; END IF;
  IF v_sender_money < p_amount THEN RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = 'P0001'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.game_progress WHERE user_id = p_receiver_id) THEN
    RAISE EXCEPTION 'receiver_not_found' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.game_progress SET money = money - p_amount, updated_at = now() WHERE user_id = v_sender_id;
  UPDATE public.game_progress SET money = money + p_amount, updated_at = now() WHERE user_id = p_receiver_id;
  INSERT INTO public.chat_messages (sender_id, receiver_id, type, content, payload)
    VALUES (v_sender_id, p_receiver_id, 'money_sent', p_message, jsonb_build_object('amount', p_amount))
    RETURNING id INTO v_message_id;
  RETURN v_message_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.send_money_to_player(uuid, numeric, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_chat_threads()
RETURNS TABLE (
  other_user_id   uuid,
  other_name      text,
  last_message_id uuid,
  last_type       text,
  last_content    text,
  last_payload    jsonb,
  last_sender_id  uuid,
  last_created_at timestamptz,
  unread_count    bigint
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001'; END IF;
  RETURN QUERY
  WITH ranked AS (
    SELECT m.*,
      CASE WHEN m.sender_id = v_user_id THEN m.receiver_id ELSE m.sender_id END AS other,
      ROW_NUMBER() OVER (
        PARTITION BY LEAST(m.sender_id, m.receiver_id), GREATEST(m.sender_id, m.receiver_id)
        ORDER BY m.created_at DESC
      ) AS rn
    FROM public.chat_messages m
    WHERE m.sender_id = v_user_id OR m.receiver_id = v_user_id
  ),
  unread AS (
    SELECT sender_id AS other, COUNT(*) AS cnt
    FROM public.chat_messages
    WHERE receiver_id = v_user_id AND read_at IS NULL
    GROUP BY sender_id
  )
  SELECT r.other, COALESCE(p.display_name, 'Jogador'), r.id, r.type, r.content, r.payload,
         r.sender_id, r.created_at, COALESCE(u.cnt, 0)
  FROM ranked r
  LEFT JOIN public.player_profiles p ON p.user_id = r.other
  LEFT JOIN unread u ON u.other = r.other
  WHERE r.rn = 1
  ORDER BY r.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_chat_threads() TO authenticated;

CREATE OR REPLACE FUNCTION public.mark_chat_thread_read(p_other_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RETURN; END IF;
  UPDATE public.chat_messages SET read_at = now()
    WHERE receiver_id = v_user_id AND sender_id = p_other_id AND read_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_chat_thread_read(uuid) TO authenticated;

-- =====================================================================
-- 5. ADMIN (login simples por senha em texto puro)
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.admin_credentials (
  username    text PRIMARY KEY,
  password    text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;

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

ALTER TABLE public.admin_error_logs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public._admin_pw_ok(p_password text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
BEGIN
  IF p_password IS NULL THEN RETURN false; END IF;
  RETURN EXISTS (SELECT 1 FROM public.admin_credentials WHERE password = p_password);
END;
$$;

GRANT EXECUTE ON FUNCTION public._admin_pw_ok(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_check_password(p_password text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
BEGIN
  RETURN public._admin_pw_ok(p_password);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_check_password(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_log_error(
  p_function_name text, p_error_message text,
  p_error_code text DEFAULT NULL, p_payload jsonb DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.admin_error_logs (user_id, function_name, error_message, error_code, payload)
    VALUES (auth.uid(), p_function_name, LEFT(p_error_message, 1000), p_error_code, p_payload);
EXCEPTION WHEN OTHERS THEN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_log_error(text, text, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_error_logs(
  p_admin_password text, p_limit int DEFAULT 100,
  p_function_name text DEFAULT NULL, p_since timestamptz DEFAULT NULL
)
RETURNS TABLE (
  id bigint, user_id uuid, user_email text, function_name text,
  error_message text, error_code text, payload jsonb, created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public._admin_pw_ok(p_admin_password) THEN RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001'; END IF;
  RETURN QUERY
    SELECT l.id, l.user_id, u.email::text, l.function_name, l.error_message,
           l.error_code, l.payload, l.created_at
    FROM public.admin_error_logs l
    LEFT JOIN auth.users u ON u.id = l.user_id
    WHERE (p_function_name IS NULL OR l.function_name = p_function_name)
      AND (p_since IS NULL OR l.created_at >= p_since)
    ORDER BY l.created_at DESC
    LIMIT GREATEST(LEAST(p_limit, 1000), 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_error_logs(text, int, text, timestamptz) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_clear_error_logs(p_admin_password text, p_older_than_days int DEFAULT 30)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_deleted int;
BEGIN
  IF NOT public._admin_pw_ok(p_admin_password) THEN RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001'; END IF;
  DELETE FROM public.admin_error_logs WHERE created_at < now() - (p_older_than_days || ' days')::interval;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_clear_error_logs(text, int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_player_money(p_admin_password text, p_target_user_id uuid, p_new_money numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public._admin_pw_ok(p_admin_password) THEN RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.game_progress WHERE user_id = p_target_user_id FOR UPDATE) THEN
    RAISE EXCEPTION 'target_not_found' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.game_progress SET money = p_new_money, updated_at = now() WHERE user_id = p_target_user_id;
  RETURN p_new_money;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_player_money(text, uuid, numeric) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_adjust_player_money(p_admin_password text, p_target_user_id uuid, p_delta numeric)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new numeric; v_current numeric;
BEGIN
  IF NOT public._admin_pw_ok(p_admin_password) THEN RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001'; END IF;
  SELECT money INTO v_current FROM public.game_progress WHERE user_id = p_target_user_id FOR UPDATE;
  IF v_current IS NULL THEN RAISE EXCEPTION 'target_not_found' USING ERRCODE = 'P0001'; END IF;
  v_new := v_current + p_delta;
  UPDATE public.game_progress SET money = v_new, updated_at = now() WHERE user_id = p_target_user_id;
  RETURN v_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_adjust_player_money(text, uuid, numeric) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_players(p_admin_password text, p_search text DEFAULT NULL, p_limit int DEFAULT 200)
RETURNS TABLE (
  user_id uuid, email text, display_name text, level int,
  total_patrimony numeric, money numeric, races_won int, updated_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public._admin_pw_ok(p_admin_password) THEN RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001'; END IF;
  RETURN QUERY
    SELECT p.user_id, u.email::text, p.display_name, p.level, p.total_patrimony,
           gp.money, COALESCE(p.races_won, 0), p.updated_at
    FROM public.player_profiles p
    LEFT JOIN auth.users u ON u.id = p.user_id
    LEFT JOIN public.game_progress gp ON gp.user_id = p.user_id
    WHERE (p_search IS NULL OR p.display_name ILIKE '%' || p_search || '%' OR u.email ILIKE '%' || p_search || '%')
    ORDER BY p.total_patrimony DESC NULLS LAST
    LIMIT GREATEST(LEAST(p_limit, 1000), 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_players(text, text, int) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_list_duplicate_accounts(p_admin_password text)
RETURNS TABLE (category text, email text, count int, oldest_user_id uuid, newest_user_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public._admin_pw_ok(p_admin_password) THEN RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001'; END IF;
  RETURN QUERY
    SELECT 'duplicate_email'::text, u.email::text, COUNT(*)::int,
           (array_agg(u.id ORDER BY u.created_at ASC))[1],
           (array_agg(u.id ORDER BY u.created_at DESC))[1]
    FROM auth.users u WHERE u.email IS NOT NULL GROUP BY u.email HAVING COUNT(*) > 1;
  RETURN QUERY
    SELECT 'orphan_profile'::text, p.display_name::text, 1::int, p.user_id, p.user_id
    FROM public.player_profiles p WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.user_id);
  RETURN QUERY
    SELECT 'orphan_progress'::text, g.user_id::text, 1::int, g.user_id, g.user_id
    FROM public.game_progress g WHERE NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = g.user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_duplicate_accounts(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_dedupe_accounts(p_admin_password text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text; v_keep_id uuid; v_kill_ids uuid[];
  v_max_money numeric; v_max_patrimony numeric;
  v_emails_processed int := 0; v_users_deleted int := 0;
  v_orphan_profiles int; v_orphan_progress int;
BEGIN
  IF NOT public._admin_pw_ok(p_admin_password) THEN RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001'; END IF;
  FOR v_email IN
    SELECT email FROM auth.users WHERE email IS NOT NULL
    GROUP BY email HAVING COUNT(*) > 1
  LOOP
    SELECT id INTO v_keep_id FROM auth.users WHERE email = v_email ORDER BY created_at ASC LIMIT 1;
    SELECT array_agg(id) INTO v_kill_ids FROM auth.users WHERE email = v_email AND id <> v_keep_id;
    IF v_keep_id IS NOT NULL AND v_kill_ids IS NOT NULL THEN
      SELECT MAX(money) INTO v_max_money FROM public.game_progress
        WHERE user_id = v_keep_id OR user_id = ANY(v_kill_ids);
      SELECT MAX(total_patrimony) INTO v_max_patrimony FROM public.player_profiles
        WHERE user_id = v_keep_id OR user_id = ANY(v_kill_ids);
      IF v_max_money IS NOT NULL THEN
        UPDATE public.game_progress SET money = v_max_money, updated_at = now() WHERE user_id = v_keep_id;
      END IF;
      IF v_max_patrimony IS NOT NULL THEN
        UPDATE public.player_profiles SET total_patrimony = v_max_patrimony, updated_at = now() WHERE user_id = v_keep_id;
      END IF;
      DELETE FROM auth.users WHERE id = ANY(v_kill_ids);
      v_users_deleted := v_users_deleted + array_length(v_kill_ids, 1);
      v_emails_processed := v_emails_processed + 1;
    END IF;
  END LOOP;
  DELETE FROM public.player_profiles WHERE user_id NOT IN (SELECT id FROM auth.users);
  GET DIAGNOSTICS v_orphan_profiles = ROW_COUNT;
  DELETE FROM public.game_progress WHERE user_id NOT IN (SELECT id FROM auth.users);
  GET DIAGNOSTICS v_orphan_progress = ROW_COUNT;
  RETURN jsonb_build_object(
    'emails_processed', v_emails_processed,
    'duplicate_users_deleted', v_users_deleted,
    'orphan_profiles_deleted', v_orphan_profiles,
    'orphan_progress_deleted', v_orphan_progress
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_dedupe_accounts(text) TO anon, authenticated;

-- =====================================================================
-- 6. CIDADE — quarteirões, lotes, RPCs de compra/venda/construção
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.city_blocks (
  id            text PRIMARY KEY,
  polygon       jsonb NOT NULL,
  neighborhood  text,
  centroid_lng  numeric,
  centroid_lat  numeric
);

ALTER TABLE public.city_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone reads blocks" ON public.city_blocks;
CREATE POLICY "anyone reads blocks" ON public.city_blocks FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.city_lots (
  id              text PRIMARY KEY,
  block_id        text NOT NULL REFERENCES public.city_blocks(id) ON DELETE CASCADE,
  polygon         jsonb NOT NULL,
  area_m2         int   NOT NULL,
  neighborhood    text,
  base_price      numeric NOT NULL,
  owner_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_name      text,
  building_type   text,
  building_level  int   NOT NULL DEFAULT 0,
  last_sold_at    timestamptz,
  last_sold_price numeric,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS city_lots_owner_idx ON public.city_lots (owner_user_id);
CREATE INDEX IF NOT EXISTS city_lots_block_idx ON public.city_lots (block_id);
CREATE INDEX IF NOT EXISTS city_lots_neighborhood_idx ON public.city_lots (neighborhood);
CREATE INDEX IF NOT EXISTS city_lots_available_idx ON public.city_lots (id) WHERE owner_user_id IS NULL;

ALTER TABLE public.city_lots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone reads lots" ON public.city_lots;
CREATE POLICY "anyone reads lots" ON public.city_lots FOR SELECT TO authenticated USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.city_lots;

CREATE OR REPLACE FUNCTION public.admin_bootstrap_city(p_admin_password text, p_blocks jsonb, p_lots jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_block jsonb; v_lot jsonb; v_blk int := 0; v_lts int := 0;
BEGIN
  IF NOT public._admin_pw_ok(p_admin_password) THEN RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001'; END IF;
  IF jsonb_typeof(p_blocks) = 'array' THEN
    FOR v_block IN SELECT * FROM jsonb_array_elements(p_blocks) LOOP
      INSERT INTO public.city_blocks (id, polygon, neighborhood, centroid_lng, centroid_lat)
        VALUES (v_block->>'id', v_block->'polygon', v_block->>'neighborhood',
                (v_block->>'centroid_lng')::numeric, (v_block->>'centroid_lat')::numeric)
        ON CONFLICT (id) DO UPDATE SET
          polygon = EXCLUDED.polygon, neighborhood = EXCLUDED.neighborhood,
          centroid_lng = EXCLUDED.centroid_lng, centroid_lat = EXCLUDED.centroid_lat;
      v_blk := v_blk + 1;
    END LOOP;
  END IF;
  IF jsonb_typeof(p_lots) = 'array' THEN
    FOR v_lot IN SELECT * FROM jsonb_array_elements(p_lots) LOOP
      INSERT INTO public.city_lots (id, block_id, polygon, area_m2, neighborhood, base_price)
        VALUES (v_lot->>'id', v_lot->>'block_id', v_lot->'polygon',
                (v_lot->>'area_m2')::int, v_lot->>'neighborhood', (v_lot->>'base_price')::numeric)
        ON CONFLICT (id) DO UPDATE SET
          polygon = EXCLUDED.polygon, area_m2 = EXCLUDED.area_m2,
          neighborhood = EXCLUDED.neighborhood, updated_at = now();
      v_lts := v_lts + 1;
    END LOOP;
  END IF;
  RETURN jsonb_build_object('blocks_upserted', v_blk, 'lots_upserted', v_lts);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_bootstrap_city(text, jsonb, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_clear_city(p_admin_password text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lots int; v_blocks int;
BEGIN
  IF NOT public._admin_pw_ok(p_admin_password) THEN RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001'; END IF;
  DELETE FROM public.city_lots; GET DIAGNOSTICS v_lots = ROW_COUNT;
  DELETE FROM public.city_blocks; GET DIAGNOSTICS v_blocks = ROW_COUNT;
  RETURN jsonb_build_object('blocks_deleted', v_blocks, 'lots_deleted', v_lots);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_clear_city(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.buy_lot(p_lot_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_money numeric; v_price numeric;
  v_owner uuid; v_owner_name text; v_new_money numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001'; END IF;
  SELECT base_price, owner_user_id INTO v_price, v_owner FROM public.city_lots WHERE id = p_lot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'lot_not_found' USING ERRCODE = 'P0001'; END IF;
  IF v_owner IS NOT NULL THEN RAISE EXCEPTION 'lot_already_owned' USING ERRCODE = 'P0001'; END IF;
  SELECT money INTO v_money FROM public.game_progress WHERE user_id = v_uid FOR UPDATE;
  IF v_money IS NULL THEN RAISE EXCEPTION 'no_game_progress' USING ERRCODE = 'P0001'; END IF;
  IF v_money < v_price THEN RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = 'P0001'; END IF;
  SELECT display_name INTO v_owner_name FROM public.player_profiles WHERE user_id = v_uid;
  v_new_money := v_money - v_price;
  UPDATE public.game_progress SET money = v_new_money, updated_at = now() WHERE user_id = v_uid;
  UPDATE public.city_lots SET owner_user_id = v_uid, owner_name = COALESCE(v_owner_name, 'Jogador'),
    last_sold_at = now(), last_sold_price = v_price, updated_at = now()
    WHERE id = p_lot_id;
  RETURN jsonb_build_object('lot_id', p_lot_id, 'price', v_price, 'new_money', v_new_money);
END;
$$;

GRANT EXECUTE ON FUNCTION public.buy_lot(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.sell_lot_to_market(p_lot_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_owner uuid; v_price numeric; v_b_level int;
  v_payout numeric; v_money numeric; v_new_money numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001'; END IF;
  SELECT owner_user_id, base_price, building_level INTO v_owner, v_price, v_b_level
    FROM public.city_lots WHERE id = p_lot_id FOR UPDATE;
  IF v_owner IS NULL OR v_owner <> v_uid THEN RAISE EXCEPTION 'not_owner' USING ERRCODE = 'P0001'; END IF;
  v_payout := round(v_price * 0.75 + v_price * 0.5 * (v_b_level ^ 1.5));
  SELECT money INTO v_money FROM public.game_progress WHERE user_id = v_uid FOR UPDATE;
  v_new_money := COALESCE(v_money, 0) + v_payout;
  UPDATE public.game_progress SET money = v_new_money, updated_at = now() WHERE user_id = v_uid;
  UPDATE public.city_lots SET owner_user_id = NULL, owner_name = NULL,
    building_type = NULL, building_level = 0, last_sold_at = now(),
    last_sold_price = v_payout, updated_at = now()
    WHERE id = p_lot_id;
  RETURN jsonb_build_object('lot_id', p_lot_id, 'payout', v_payout, 'new_money', v_new_money);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sell_lot_to_market(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.build_on_lot(p_lot_id text, p_building_type text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_owner uuid; v_price numeric; v_level int;
  v_cost numeric; v_money numeric; v_new_money numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001'; END IF;
  IF p_building_type NOT IN ('house','commerce','industry','office','residential','farm','garage') THEN
    RAISE EXCEPTION 'invalid_building_type' USING ERRCODE = 'P0001';
  END IF;
  SELECT owner_user_id, base_price, building_level INTO v_owner, v_price, v_level
    FROM public.city_lots WHERE id = p_lot_id FOR UPDATE;
  IF v_owner IS NULL OR v_owner <> v_uid THEN RAISE EXCEPTION 'not_owner' USING ERRCODE = 'P0001'; END IF;
  v_cost := round(v_price * 0.50);
  SELECT money INTO v_money FROM public.game_progress WHERE user_id = v_uid FOR UPDATE;
  IF COALESCE(v_money, 0) < v_cost THEN RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = 'P0001'; END IF;
  v_new_money := v_money - v_cost;
  UPDATE public.game_progress SET money = v_new_money, updated_at = now() WHERE user_id = v_uid;
  UPDATE public.city_lots SET building_type = p_building_type,
    building_level = GREATEST(v_level, 1), updated_at = now()
    WHERE id = p_lot_id;
  RETURN jsonb_build_object('lot_id', p_lot_id, 'cost', v_cost,
    'new_money', v_new_money, 'building_type', p_building_type,
    'building_level', GREATEST(v_level, 1));
END;
$$;

GRANT EXECUTE ON FUNCTION public.build_on_lot(text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.upgrade_building(p_lot_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid(); v_owner uuid; v_price numeric; v_level int; v_btype text;
  v_cost numeric; v_money numeric; v_new_money numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001'; END IF;
  SELECT owner_user_id, base_price, building_level, building_type
    INTO v_owner, v_price, v_level, v_btype
    FROM public.city_lots WHERE id = p_lot_id FOR UPDATE;
  IF v_owner IS NULL OR v_owner <> v_uid THEN RAISE EXCEPTION 'not_owner' USING ERRCODE = 'P0001'; END IF;
  IF v_btype IS NULL OR v_level <= 0 THEN RAISE EXCEPTION 'no_building' USING ERRCODE = 'P0001'; END IF;
  IF v_level >= 5 THEN RAISE EXCEPTION 'max_level' USING ERRCODE = 'P0001'; END IF;
  v_cost := round(v_price * (v_level + 1) * 0.40);
  SELECT money INTO v_money FROM public.game_progress WHERE user_id = v_uid FOR UPDATE;
  IF COALESCE(v_money, 0) < v_cost THEN RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = 'P0001'; END IF;
  v_new_money := v_money - v_cost;
  UPDATE public.game_progress SET money = v_new_money, updated_at = now() WHERE user_id = v_uid;
  UPDATE public.city_lots SET building_level = v_level + 1, updated_at = now() WHERE id = p_lot_id;
  RETURN jsonb_build_object('lot_id', p_lot_id, 'cost', v_cost,
    'new_money', v_new_money, 'building_level', v_level + 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.upgrade_building(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_city_summary()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE v_total int; v_owned int; v_built int; v_value_owned numeric;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE owner_user_id IS NOT NULL),
         COUNT(*) FILTER (WHERE building_type IS NOT NULL),
         COALESCE(SUM(base_price) FILTER (WHERE owner_user_id IS NOT NULL), 0)
    INTO v_total, v_owned, v_built, v_value_owned
    FROM public.city_lots;
  RETURN jsonb_build_object('total_lots', v_total, 'owned_lots', v_owned,
    'built_lots', v_built, 'value_owned', v_value_owned);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_city_summary() TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;

-- =====================================================================
-- BOOTSTRAP MANUAL — RODE DEPOIS DO COMMIT ACIMA
--
-- Define a senha do painel admin. Troque "alife1219!" por outra se quiser.
-- =====================================================================

INSERT INTO public.admin_credentials (username, password)
  VALUES ('alife', 'alife1219!')
  ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password;

-- Teste rápido pra confirmar:
SELECT username, length(password) AS pw_len FROM public.admin_credentials;
