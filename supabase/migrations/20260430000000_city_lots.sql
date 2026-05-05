-- =====================================================================
-- Migration: Sistema de cidade — compra/venda/construção de lotes
--
-- Componentes:
--   • city_lots          — todos os lotes (polígono, área, preço base, dono)
--   • city_blocks        — quarteirões (agrupamento dos lotes, com bairro)
--   • city_buildings     — tipos de construção disponíveis (estática, JSONB)
--   • RPCs:
--       admin_bootstrap_city(p_admin_password, p_data) — bulk insert (chunked)
--       admin_clear_city(p_admin_password)              — reseta tudo
--       buy_lot(p_lot_id)                               — compra do mercado base
--       sell_lot_to_market(p_lot_id)                    — vende de volta (75%)
--       build_on_lot(p_lot_id, p_building_type)         — constrói/troca prédio
--       upgrade_building(p_lot_id)                      — sobe nível (custo crescente)
-- =====================================================================

BEGIN;

-- ── Tabela: city_blocks ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.city_blocks (
  id            text PRIMARY KEY,
  polygon       jsonb NOT NULL,           -- [[lng,lat], ...] coords
  neighborhood  text,
  centroid_lng  numeric,
  centroid_lat  numeric
);

ALTER TABLE public.city_blocks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone reads blocks" ON public.city_blocks;
CREATE POLICY "anyone reads blocks" ON public.city_blocks
  FOR SELECT TO authenticated USING (true);

-- ── Tabela: city_lots ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.city_lots (
  id              text PRIMARY KEY,
  block_id        text NOT NULL REFERENCES public.city_blocks(id) ON DELETE CASCADE,
  polygon         jsonb NOT NULL,
  area_m2         int   NOT NULL,
  neighborhood    text,
  base_price      numeric NOT NULL,
  owner_user_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  owner_name      text,                   -- snapshot do display_name (pra exibir sem JOIN)
  building_type   text,                   -- 'house' | 'commerce' | 'industry' | 'office' | etc
  building_level  int   NOT NULL DEFAULT 0,
  last_sold_at    timestamptz,
  last_sold_price numeric,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS city_lots_owner_idx       ON public.city_lots (owner_user_id);
CREATE INDEX IF NOT EXISTS city_lots_block_idx       ON public.city_lots (block_id);
CREATE INDEX IF NOT EXISTS city_lots_neighborhood_idx ON public.city_lots (neighborhood);
CREATE INDEX IF NOT EXISTS city_lots_available_idx
  ON public.city_lots (id) WHERE owner_user_id IS NULL;

ALTER TABLE public.city_lots ENABLE ROW LEVEL SECURITY;

-- Todos podem ler (mapa público)
DROP POLICY IF EXISTS "anyone reads lots" ON public.city_lots;
CREATE POLICY "anyone reads lots" ON public.city_lots
  FOR SELECT TO authenticated USING (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.city_lots;

-- ── Catálogo de construções ────────────────────────────────────────
-- Definição estática (não vai para tabela): cada tipo tem custo base e
-- multiplicador de upgrade. Constam aqui apenas para referência; a
-- validação de tipo é via CHECK constraint na função build_on_lot.

-- ── RPC: admin_bootstrap_city (chunked) ────────────────────────────
-- Recebe array de blocks + array de lots. O cliente chama esta RPC
-- várias vezes com chunks de ~500 lotes cada (limite do payload JSON).
-- Idempotente via ON CONFLICT.
CREATE OR REPLACE FUNCTION public.admin_bootstrap_city(
  p_admin_password text,
  p_blocks         jsonb,
  p_lots           jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_block jsonb;
  v_lot   jsonb;
  v_blk   int := 0;
  v_lts   int := 0;
BEGIN
  IF NOT public._admin_pw_ok(p_admin_password) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;

  -- Blocks
  IF jsonb_typeof(p_blocks) = 'array' THEN
    FOR v_block IN SELECT * FROM jsonb_array_elements(p_blocks) LOOP
      INSERT INTO public.city_blocks (id, polygon, neighborhood, centroid_lng, centroid_lat)
        VALUES (
          v_block->>'id',
          v_block->'polygon',
          v_block->>'neighborhood',
          (v_block->>'centroid_lng')::numeric,
          (v_block->>'centroid_lat')::numeric
        )
        ON CONFLICT (id) DO UPDATE SET
          polygon      = EXCLUDED.polygon,
          neighborhood = EXCLUDED.neighborhood,
          centroid_lng = EXCLUDED.centroid_lng,
          centroid_lat = EXCLUDED.centroid_lat;
      v_blk := v_blk + 1;
    END LOOP;
  END IF;

  -- Lots
  IF jsonb_typeof(p_lots) = 'array' THEN
    FOR v_lot IN SELECT * FROM jsonb_array_elements(p_lots) LOOP
      INSERT INTO public.city_lots (id, block_id, polygon, area_m2, neighborhood, base_price)
        VALUES (
          v_lot->>'id',
          v_lot->>'block_id',
          v_lot->'polygon',
          (v_lot->>'area_m2')::int,
          v_lot->>'neighborhood',
          (v_lot->>'base_price')::numeric
        )
        ON CONFLICT (id) DO UPDATE SET
          polygon      = EXCLUDED.polygon,
          area_m2      = EXCLUDED.area_m2,
          neighborhood = EXCLUDED.neighborhood,
          -- Não sobrescreve base_price se já existe (admin pode ter ajustado)
          updated_at   = now();
      v_lts := v_lts + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('blocks_upserted', v_blk, 'lots_upserted', v_lts);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_bootstrap_city(text, jsonb, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_bootstrap_city(text, jsonb, jsonb) TO anon, authenticated;

-- ── RPC: admin_clear_city ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_clear_city(p_admin_password text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lots   int;
  v_blocks int;
BEGIN
  IF NOT public._admin_pw_ok(p_admin_password) THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM public.city_lots;   GET DIAGNOSTICS v_lots   = ROW_COUNT;
  DELETE FROM public.city_blocks; GET DIAGNOSTICS v_blocks = ROW_COUNT;
  RETURN jsonb_build_object('blocks_deleted', v_blocks, 'lots_deleted', v_lots);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_clear_city(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_clear_city(text) TO anon, authenticated;

-- ── RPC: buy_lot ──────────────────────────────────────────────────
-- Jogador compra lote disponível pelo base_price. Atomicamente:
--  - valida saldo (game_progress.money >= base_price)
--  - debita saldo + JSONB
--  - marca lote como dele
CREATE OR REPLACE FUNCTION public.buy_lot(p_lot_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_money        numeric;
  v_price        numeric;
  v_owner        uuid;
  v_owner_name   text;
  v_new_money    numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;

  -- Trava o lote
  SELECT base_price, owner_user_id INTO v_price, v_owner
    FROM public.city_lots WHERE id = p_lot_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'lot_not_found' USING ERRCODE = 'P0001';
  END IF;
  IF v_owner IS NOT NULL THEN
    RAISE EXCEPTION 'lot_already_owned' USING ERRCODE = 'P0001';
  END IF;

  -- Valida saldo
  SELECT money INTO v_money FROM public.game_progress
    WHERE user_id = v_uid FOR UPDATE;
  IF v_money IS NULL THEN
    RAISE EXCEPTION 'no_game_progress' USING ERRCODE = 'P0001';
  END IF;
  IF v_money < v_price THEN
    RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = 'P0001';
  END IF;

  -- Snapshot do nome
  SELECT display_name INTO v_owner_name FROM public.player_profiles WHERE user_id = v_uid;

  -- Debita saldo (coluna + JSONB)
  v_new_money := v_money - v_price;
  UPDATE public.game_progress
    SET money         = v_new_money,
        car_game_data = CASE
          WHEN car_game_data IS NULL THEN jsonb_build_object('money', v_new_money)
          ELSE jsonb_set(car_game_data, '{money}', to_jsonb(v_new_money))
        END,
        updated_at    = now()
    WHERE user_id = v_uid;

  -- Atribui o lote
  UPDATE public.city_lots
    SET owner_user_id   = v_uid,
        owner_name      = COALESCE(v_owner_name, 'Jogador'),
        last_sold_at    = now(),
        last_sold_price = v_price,
        updated_at      = now()
    WHERE id = p_lot_id;

  RETURN jsonb_build_object(
    'lot_id',     p_lot_id,
    'price',      v_price,
    'new_money',  v_new_money
  );
END;
$$;

REVOKE ALL ON FUNCTION public.buy_lot(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buy_lot(text) TO authenticated;

-- ── RPC: sell_lot_to_market ──────────────────────────────────────
-- Jogador vende lote DELE de volta para o mercado por 75% do base_price.
-- Construção é mantida apenas se o jogador comprar de novo (perde building).
CREATE OR REPLACE FUNCTION public.sell_lot_to_market(p_lot_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_owner     uuid;
  v_price     numeric;
  v_b_level   int;
  v_payout    numeric;
  v_money     numeric;
  v_new_money numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;

  SELECT owner_user_id, base_price, building_level
    INTO v_owner, v_price, v_b_level
    FROM public.city_lots WHERE id = p_lot_id FOR UPDATE;
  IF v_owner IS NULL OR v_owner <> v_uid THEN
    RAISE EXCEPTION 'not_owner' USING ERRCODE = 'P0001';
  END IF;

  -- Payout: 75% do terreno + 50% do investimento na construção
  -- (custo da construção é base_price * (level^1.5) — ver build_on_lot)
  v_payout := round(v_price * 0.75 + v_price * 0.5 * (v_b_level ^ 1.5));

  SELECT money INTO v_money FROM public.game_progress
    WHERE user_id = v_uid FOR UPDATE;
  v_new_money := COALESCE(v_money, 0) + v_payout;

  UPDATE public.game_progress
    SET money         = v_new_money,
        car_game_data = CASE
          WHEN car_game_data IS NULL THEN jsonb_build_object('money', v_new_money)
          ELSE jsonb_set(car_game_data, '{money}', to_jsonb(v_new_money))
        END,
        updated_at    = now()
    WHERE user_id = v_uid;

  UPDATE public.city_lots
    SET owner_user_id   = NULL,
        owner_name      = NULL,
        building_type   = NULL,
        building_level  = 0,
        last_sold_at    = now(),
        last_sold_price = v_payout,
        updated_at      = now()
    WHERE id = p_lot_id;

  RETURN jsonb_build_object('lot_id', p_lot_id, 'payout', v_payout, 'new_money', v_new_money);
END;
$$;

REVOKE ALL ON FUNCTION public.sell_lot_to_market(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sell_lot_to_market(text) TO authenticated;

-- ── RPC: build_on_lot ────────────────────────────────────────────
-- Constrói uma edificação tipo `p_building_type` (level 1) no lote.
-- Custa: base_price * 0.50.
-- Se já tem construção, troca o tipo (mas não muda o nível).
CREATE OR REPLACE FUNCTION public.build_on_lot(
  p_lot_id        text,
  p_building_type text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_owner    uuid;
  v_price    numeric;
  v_level    int;
  v_cost     numeric;
  v_money    numeric;
  v_new_money numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;
  IF p_building_type NOT IN ('house','commerce','industry','office','residential','farm','garage') THEN
    RAISE EXCEPTION 'invalid_building_type' USING ERRCODE = 'P0001';
  END IF;

  SELECT owner_user_id, base_price, building_level
    INTO v_owner, v_price, v_level
    FROM public.city_lots WHERE id = p_lot_id FOR UPDATE;
  IF v_owner IS NULL OR v_owner <> v_uid THEN
    RAISE EXCEPTION 'not_owner' USING ERRCODE = 'P0001';
  END IF;

  v_cost := round(v_price * 0.50);

  SELECT money INTO v_money FROM public.game_progress
    WHERE user_id = v_uid FOR UPDATE;
  IF COALESCE(v_money, 0) < v_cost THEN
    RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = 'P0001';
  END IF;

  v_new_money := v_money - v_cost;
  UPDATE public.game_progress
    SET money         = v_new_money,
        car_game_data = CASE
          WHEN car_game_data IS NULL THEN jsonb_build_object('money', v_new_money)
          ELSE jsonb_set(car_game_data, '{money}', to_jsonb(v_new_money))
        END,
        updated_at    = now()
    WHERE user_id = v_uid;

  UPDATE public.city_lots
    SET building_type   = p_building_type,
        building_level  = GREATEST(v_level, 1),
        updated_at      = now()
    WHERE id = p_lot_id;

  RETURN jsonb_build_object(
    'lot_id',         p_lot_id,
    'cost',           v_cost,
    'new_money',      v_new_money,
    'building_type',  p_building_type,
    'building_level', GREATEST(v_level, 1)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.build_on_lot(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.build_on_lot(text, text) TO authenticated;

-- ── RPC: upgrade_building ────────────────────────────────────────
-- Sobe o nível da construção (max 5). Custo escala: base_price * level * 0.4
CREATE OR REPLACE FUNCTION public.upgrade_building(p_lot_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_owner    uuid;
  v_price    numeric;
  v_level    int;
  v_btype    text;
  v_cost     numeric;
  v_money    numeric;
  v_new_money numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;

  SELECT owner_user_id, base_price, building_level, building_type
    INTO v_owner, v_price, v_level, v_btype
    FROM public.city_lots WHERE id = p_lot_id FOR UPDATE;
  IF v_owner IS NULL OR v_owner <> v_uid THEN
    RAISE EXCEPTION 'not_owner' USING ERRCODE = 'P0001';
  END IF;
  IF v_btype IS NULL OR v_level <= 0 THEN
    RAISE EXCEPTION 'no_building' USING ERRCODE = 'P0001';
  END IF;
  IF v_level >= 5 THEN
    RAISE EXCEPTION 'max_level' USING ERRCODE = 'P0001';
  END IF;

  v_cost := round(v_price * (v_level + 1) * 0.40);

  SELECT money INTO v_money FROM public.game_progress
    WHERE user_id = v_uid FOR UPDATE;
  IF COALESCE(v_money, 0) < v_cost THEN
    RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = 'P0001';
  END IF;

  v_new_money := v_money - v_cost;
  UPDATE public.game_progress
    SET money         = v_new_money,
        car_game_data = CASE
          WHEN car_game_data IS NULL THEN jsonb_build_object('money', v_new_money)
          ELSE jsonb_set(car_game_data, '{money}', to_jsonb(v_new_money))
        END,
        updated_at    = now()
    WHERE user_id = v_uid;

  UPDATE public.city_lots
    SET building_level = v_level + 1,
        updated_at     = now()
    WHERE id = p_lot_id;

  RETURN jsonb_build_object(
    'lot_id',         p_lot_id,
    'cost',           v_cost,
    'new_money',      v_new_money,
    'building_level', v_level + 1
  );
END;
$$;

REVOKE ALL ON FUNCTION public.upgrade_building(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.upgrade_building(text) TO authenticated;

-- ── RPC: get_city_summary (resumo rápido pro admin/header) ────────
CREATE OR REPLACE FUNCTION public.get_city_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_total      int;
  v_owned      int;
  v_built      int;
  v_value_owned numeric;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE owner_user_id IS NOT NULL),
         COUNT(*) FILTER (WHERE building_type IS NOT NULL),
         COALESCE(SUM(base_price) FILTER (WHERE owner_user_id IS NOT NULL), 0)
    INTO v_total, v_owned, v_built, v_value_owned
    FROM public.city_lots;

  RETURN jsonb_build_object(
    'total_lots',  v_total,
    'owned_lots',  v_owned,
    'built_lots',  v_built,
    'value_owned', v_value_owned
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_city_summary() TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
