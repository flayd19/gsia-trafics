-- ================================================================
-- GSIA CARROS — Reset completo do Supabase
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute.
-- ================================================================

-- ----------------------------------------------------------------
-- 1. DROPAR tabelas antigas (seguro — usa IF EXISTS)
-- ----------------------------------------------------------------
DROP TABLE IF EXISTS player_market_listings   CASCADE;
DROP TABLE IF EXISTS player_ranking           CASCADE;
DROP TABLE IF EXISTS player_profiles          CASCADE;
DROP TABLE IF EXISTS game_progress            CASCADE;
DROP TABLE IF EXISTS game_backups             CASCADE;
DROP TABLE IF EXISTS activity_logs            CASCADE;
DROP TABLE IF EXISTS simple_game_progress     CASCADE;
DROP TABLE IF EXISTS centralized_game_progress CASCADE;
DROP TABLE IF EXISTS trips                    CASCADE;
DROP TABLE IF EXISTS stores                   CASCADE;
DROP TABLE IF EXISTS warehouse                CASCADE;
DROP TABLE IF EXISTS vehicles                 CASCADE;
DROP TABLE IF EXISTS drivers                  CASCADE;
DROP TABLE IF EXISTS stock                    CASCADE;

-- ----------------------------------------------------------------
-- 2. DROPAR funções antigas
-- ----------------------------------------------------------------
DROP FUNCTION IF EXISTS ensure_user_bootstrap(text)            CASCADE;
DROP FUNCTION IF EXISTS purchase_market_listing(uuid)          CASCADE;
DROP FUNCTION IF EXISTS cancel_market_listing(uuid)            CASCADE;
DROP FUNCTION IF EXISTS collect_market_payouts()               CASCADE;
DROP FUNCTION IF EXISTS save_car_game(jsonb)                   CASCADE;
DROP FUNCTION IF EXISTS load_car_game()                        CASCADE;
DROP FUNCTION IF EXISTS reset_car_game()                       CASCADE;
DROP FUNCTION IF EXISTS update_player_ranking_complete(uuid)   CASCADE;

-- ================================================================
-- 3. CRIAR tabelas
-- ================================================================

-- ── game_progress ──────────────────────────────────────────────
CREATE TABLE game_progress (
  user_id       uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  car_game_data jsonb    DEFAULT NULL,
  money         numeric  DEFAULT 50000,
  updated_at    timestamptz DEFAULT now()
);

ALTER TABLE game_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_progress" ON game_progress
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── player_profiles ────────────────────────────────────────────
CREATE TABLE player_profiles (
  user_id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    text,
  total_patrimony numeric  DEFAULT 50000,
  level           int      DEFAULT 1,
  updated_at      timestamptz DEFAULT now()
);

ALTER TABLE player_profiles ENABLE ROW LEVEL SECURITY;

-- Leitura pública (ranking visível a todos)
CREATE POLICY "public_read_profiles" ON player_profiles
  FOR SELECT USING (true);

-- Escrita apenas do próprio usuário
CREATE POLICY "own_write_profiles" ON player_profiles
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ── player_market_listings ─────────────────────────────────────
CREATE TABLE player_market_listings (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_name    text NOT NULL DEFAULT 'Jogador',
  product_id     text NOT NULL,          -- id do carro (data/cars.ts)
  product_name   text NOT NULL,          -- nome para exibição
  product_icon   text,                   -- emoji
  category       text DEFAULT 'carro',
  quantity       int  NOT NULL DEFAULT 1,
  price_per_unit numeric NOT NULL,
  status         text NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active','sold','cancelled','collected')),
  buyer_id       uuid REFERENCES auth.users(id),
  sold_at        timestamptz,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE player_market_listings ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado pode ver anúncios ativos
CREATE POLICY "read_active_listings" ON player_market_listings
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Vendedor gerencia os próprios anúncios
CREATE POLICY "seller_manage" ON player_market_listings
  FOR ALL USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

-- Comprador pode atualizar (marcar como sold)
CREATE POLICY "buyer_purchase" ON player_market_listings
  FOR UPDATE USING (
    status = 'active' AND seller_id <> auth.uid()
  );

-- ================================================================
-- 4. CRIAR funções (RPCs)
-- ================================================================

-- ── ensure_user_bootstrap ──────────────────────────────────────
-- Chamada no login para garantir que o perfil existe
CREATE OR REPLACE FUNCTION ensure_user_bootstrap(p_display_name text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO player_profiles (user_id, display_name, total_patrimony, level)
  VALUES (
    auth.uid(),
    COALESCE(p_display_name, split_part(auth.email(), '@', 1), 'Jogador'),
    50000,
    1
  )
  ON CONFLICT (user_id) DO UPDATE
    SET display_name = COALESCE(EXCLUDED.display_name, player_profiles.display_name),
        updated_at   = now();

  INSERT INTO game_progress (user_id, money)
  VALUES (auth.uid(), 50000)
  ON CONFLICT (user_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION ensure_user_bootstrap(text) TO authenticated;

-- ── purchase_market_listing ────────────────────────────────────
-- Compra atômica: marca listing como sold
CREATE OR REPLACE FUNCTION purchase_market_listing(p_listing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_listing player_market_listings%ROWTYPE;
BEGIN
  -- Busca e trava a linha
  SELECT * INTO v_listing
  FROM player_market_listings
  WHERE id = p_listing_id AND status = 'active'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Anúncio não encontrado ou já vendido.');
  END IF;

  IF v_listing.seller_id = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Você não pode comprar seu próprio anúncio.');
  END IF;

  -- Marca como vendido
  UPDATE player_market_listings
  SET status   = 'sold',
      buyer_id = auth.uid(),
      sold_at  = now(),
      updated_at = now()
  WHERE id = p_listing_id;

  RETURN jsonb_build_object(
    'success',        true,
    'message',        'Compra realizada com sucesso!',
    'product_name',   v_listing.product_name,
    'price_per_unit', v_listing.price_per_unit,
    'quantity',       v_listing.quantity
  );
END;
$$;

GRANT EXECUTE ON FUNCTION purchase_market_listing(uuid) TO authenticated;

-- ── cancel_market_listing ──────────────────────────────────────
CREATE OR REPLACE FUNCTION cancel_market_listing(p_listing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE player_market_listings
  SET status     = 'cancelled',
      updated_at = now()
  WHERE id        = p_listing_id
    AND seller_id = auth.uid()
    AND status    = 'active';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Anúncio não encontrado ou já encerrado.');
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Anúncio cancelado.');
END;
$$;

GRANT EXECUTE ON FUNCTION cancel_market_listing(uuid) TO authenticated;

-- ── collect_market_payouts ─────────────────────────────────────
-- Coleta pagamentos de carros vendidos pelo jogador atual
CREATE OR REPLACE FUNCTION collect_market_payouts()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_total   numeric := 0;
  v_count   int     := 0;
  v_ids     uuid[]  := '{}';
  v_listing player_market_listings%ROWTYPE;
BEGIN
  FOR v_listing IN
    SELECT * FROM player_market_listings
    WHERE seller_id = auth.uid() AND status = 'sold'
    FOR UPDATE
  LOOP
    v_total := v_total + (v_listing.price_per_unit * v_listing.quantity);
    v_count := v_count + 1;
    v_ids   := v_ids || v_listing.id;
  END LOOP;

  IF v_count > 0 THEN
    UPDATE player_market_listings
    SET status     = 'collected',
        updated_at = now()
    WHERE id = ANY(v_ids);
  END IF;

  RETURN jsonb_build_object(
    'success',  true,
    'total',    v_total,
    'count',    v_count,
    'listings', v_ids
  );
END;
$$;

GRANT EXECUTE ON FUNCTION collect_market_payouts() TO authenticated;

-- ================================================================
-- 5. VERIFICAÇÃO FINAL
-- ================================================================
DO $$
BEGIN
  RAISE NOTICE '✓ game_progress criada: %',
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'game_progress');
  RAISE NOTICE '✓ player_profiles criada: %',
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'player_profiles');
  RAISE NOTICE '✓ player_market_listings criada: %',
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'player_market_listings');
  RAISE NOTICE '✓ Funções: ensure_user_bootstrap, purchase_market_listing, cancel_market_listing, collect_market_payouts';
  RAISE NOTICE '✓ Reset concluido! Supabase pronto para GSIA Carros.';
END;
$$;
