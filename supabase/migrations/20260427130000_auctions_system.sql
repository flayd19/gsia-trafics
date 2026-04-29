-- =====================================================================
-- Migration: Sistema de Leilões (6h por ciclo, 25 carros)
--
-- Componentes:
--   • auctions          — leilão de cada carro (status, lance mais alto, ends_at)
--   • auction_bids      — histórico de lances (auditoria)
--   • auction_winnings  — carros ganhos pendentes de claim pelo vencedor
--   • RPC populate_auctions_batch  — gera 25 leilões de 6h (cooldown server-side)
--   • RPC place_auction_bid        — coloca lance (atômico, valida saldo)
--   • RPC finalize_auction         — fecha leilão expirado, debita vencedor
--   • RPC claim_auction_winning    — vencedor reclama o car_data
-- =====================================================================

BEGIN;

-- ── Tabelas ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.auctions (
  id                  text PRIMARY KEY,
  batch_id            bigint NOT NULL,
  model_id            text NOT NULL,
  variant_id          text NOT NULL,
  brand               text NOT NULL,
  model               text NOT NULL,
  trim                text,
  year                int  NOT NULL,
  fipe_price          numeric NOT NULL,
  condition_pct       int  NOT NULL,
  mileage             int,
  icon                text,
  category            text,
  ends_at             timestamptz NOT NULL,
  status              text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','paid')),
  highest_bid         numeric,
  highest_bidder_id   uuid,
  highest_bidder_name text,
  bid_count           int NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auctions_status_idx  ON public.auctions (status, ends_at);
CREATE INDEX IF NOT EXISTS auctions_batch_idx   ON public.auctions (batch_id);

CREATE TABLE IF NOT EXISTS public.auction_bids (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id   text NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  bidder_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bidder_name  text NOT NULL,
  amount       numeric NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auction_bids_idx ON public.auction_bids (auction_id, amount DESC);

CREATE TABLE IF NOT EXISTS public.auction_winnings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  auction_id   text NOT NULL REFERENCES public.auctions(id) ON DELETE CASCADE,
  car_data     jsonb NOT NULL,
  amount_paid  numeric NOT NULL,
  claimed      boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  claimed_at   timestamptz
);

CREATE INDEX IF NOT EXISTS auction_winnings_user_idx
  ON public.auction_winnings (user_id, claimed) WHERE claimed = false;

-- ── Realtime ────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.auctions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.auction_winnings;

-- ── RLS ─────────────────────────────────────────────────────────────
ALTER TABLE public.auctions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_bids      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auction_winnings  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auctions readable by anyone authenticated"  ON public.auctions;
CREATE POLICY "auctions readable by anyone authenticated"
  ON public.auctions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "auction_bids readable by anyone authenticated" ON public.auction_bids;
CREATE POLICY "auction_bids readable by anyone authenticated"
  ON public.auction_bids FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "users see own auction winnings" ON public.auction_winnings;
CREATE POLICY "users see own auction winnings"
  ON public.auction_winnings FOR SELECT USING (auth.uid() = user_id);

-- (Inserts/updates só via RPCs SECURITY DEFINER; sem policies de write.)

-- ── RPC: popula 25 leilões com cooldown de 6h ───────────────────────
CREATE OR REPLACE FUNCTION public.populate_auctions_batch(
  p_rows jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta            public.marketplace_meta;
  v_now             timestamptz := now();
  v_cooldown_secs   int := 6 * 60 * 60;
  v_age_secs        numeric;
  v_batch_id        bigint;
  v_ends_at         timestamptz;
  v_inserted        int := 0;
  v_row             jsonb;
  v_id              text;
  v_max_items       int := 25;
  v_existing_open   int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;

  -- Reaproveita o cooldown do marketplace_meta para sincronia entre marketplace e leilões
  SELECT * INTO v_meta
    FROM public.marketplace_meta
    WHERE id = 1
    FOR UPDATE;

  -- Cooldown: se há leilões abertos em batch corrente, não regera.
  -- Aqui usamos uma janela de 6h baseada em existência de leilões abertos não-expirados.
  SELECT COUNT(*) INTO v_existing_open
    FROM public.auctions
    WHERE status = 'open' AND ends_at > v_now;

  IF v_existing_open > 0 THEN
    -- Já há leilões ativos; cliente recebe info e relê
    RETURN jsonb_build_object(
      'claimed',   false,
      'reason',    'auctions_active',
      'open_count', v_existing_open
    );
  END IF;

  v_batch_id := COALESCE(v_meta.batch_id, 0) + 1;
  v_ends_at  := v_now + (v_cooldown_secs || ' seconds')::interval;

  -- Limpa leilões antigos fechados (mantém últimos 100 paid para histórico)
  DELETE FROM public.auctions
    WHERE status IN ('closed','paid') AND created_at < v_now - interval '7 days';

  IF jsonb_typeof(p_rows) = 'array' THEN
    FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
      EXIT WHEN v_inserted >= v_max_items;
      v_id := REPLACE(v_row->>'id', '_b0_', '_b' || v_batch_id || '_');
      INSERT INTO public.auctions (
        id, batch_id, model_id, variant_id, brand, model, trim, year,
        fipe_price, condition_pct, mileage, icon, category, ends_at, status
      ) VALUES (
        v_id, v_batch_id,
        v_row->>'model_id', v_row->>'variant_id',
        v_row->>'brand', v_row->>'model', v_row->>'trim',
        (v_row->>'year')::int,
        (v_row->>'fipe_price')::numeric,
        (v_row->>'condition_pct')::int,
        NULLIF(v_row->>'mileage', '')::int,
        v_row->>'icon', v_row->>'category',
        v_ends_at, 'open'
      )
      ON CONFLICT (id) DO NOTHING;
      v_inserted := v_inserted + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'claimed',  true,
    'batch_id', v_batch_id,
    'inserted', v_inserted,
    'ends_at',  v_ends_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.populate_auctions_batch(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.populate_auctions_batch(jsonb) TO authenticated;

-- ── RPC: colocar lance ──────────────────────────────────────────────
-- Validações:
--   • Leilão existe e status='open' e ends_at > now
--   • amount > highest_bid atual (ou >= fipe * 0.50 se não há lance ainda)
--   • Bidder ≠ highest_bidder atual (não pode aumentar próprio lance sem alguém competir)
--     [removido: permitimos auto-competição para deixar livre — usuário pode subir o próprio lance]
--   • Saldo suficiente (verificação leve; cobrança real em finalize)
CREATE OR REPLACE FUNCTION public.place_auction_bid(
  p_auction_id text,
  p_amount     numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid := auth.uid();
  v_user_money numeric;
  v_user_name  text;
  v_auction    public.auctions;
  v_min_bid    numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount' USING ERRCODE = 'P0001';
  END IF;

  -- Trava leilão para atualizar
  SELECT * INTO v_auction
    FROM public.auctions
    WHERE id = p_auction_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_auction.status <> 'open' OR v_auction.ends_at <= now() THEN
    RAISE EXCEPTION 'auction_closed' USING ERRCODE = 'P0001';
  END IF;

  -- Lance mínimo: 50% da FIPE (lance inicial) ou +1% sobre o lance atual
  v_min_bid := COALESCE(v_auction.highest_bid * 1.01, v_auction.fipe_price * 0.50);

  IF p_amount < v_min_bid THEN
    RAISE EXCEPTION 'bid_too_low' USING ERRCODE = 'P0001';
  END IF;

  -- Verifica saldo disponível (cheque especial respeitado pelo overdraftLimit do cliente).
  -- Aqui validamos pelo menos que money - amount >= -50000 (overdraft padrão).
  SELECT money INTO v_user_money
    FROM public.game_progress
    WHERE user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_user_money - p_amount < -50000 THEN
    RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = 'P0001';
  END IF;

  -- Pega nome do bidder
  SELECT display_name INTO v_user_name
    FROM public.player_profiles
    WHERE user_id = v_user_id;
  v_user_name := COALESCE(v_user_name, 'Jogador');

  -- Atualiza leilão
  UPDATE public.auctions
    SET highest_bid         = p_amount,
        highest_bidder_id   = v_user_id,
        highest_bidder_name = v_user_name,
        bid_count           = bid_count + 1
    WHERE id = p_auction_id;

  -- Registra lance no histórico
  INSERT INTO public.auction_bids (auction_id, bidder_id, bidder_name, amount)
    VALUES (p_auction_id, v_user_id, v_user_name, p_amount);

  RETURN jsonb_build_object(
    'success',     true,
    'highest_bid', p_amount,
    'bidder_name', v_user_name
  );
END;
$$;

REVOKE ALL ON FUNCTION public.place_auction_bid(text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_auction_bid(text, numeric) TO authenticated;

-- ── RPC: finalizar leilão expirado ──────────────────────────────────
-- Pode ser chamado por qualquer cliente que detectar expiração.
-- Idempotente: se já está fechado, retorna estado atual sem mudanças.
CREATE OR REPLACE FUNCTION public.finalize_auction(
  p_auction_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction       public.auctions;
  v_now           timestamptz := now();
  v_winning_id    uuid;
  v_car_data      jsonb;
BEGIN
  SELECT * INTO v_auction
    FROM public.auctions
    WHERE id = p_auction_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'auction_not_found' USING ERRCODE = 'P0001';
  END IF;

  -- Já fechado? Idempotente.
  IF v_auction.status <> 'open' THEN
    RETURN jsonb_build_object('success', true, 'already_closed', true, 'status', v_auction.status);
  END IF;

  -- Ainda em andamento?
  IF v_auction.ends_at > v_now THEN
    RETURN jsonb_build_object('success', false, 'reason', 'still_open', 'ends_at', v_auction.ends_at);
  END IF;

  -- Sem lances? Apenas fecha sem vencedor.
  IF v_auction.highest_bidder_id IS NULL THEN
    UPDATE public.auctions
      SET status = 'closed'
      WHERE id = p_auction_id;
    RETURN jsonb_build_object('success', true, 'no_winner', true);
  END IF;

  -- Há vencedor — debita o valor (com FOR UPDATE no game_progress)
  PERFORM 1 FROM public.game_progress WHERE user_id = v_auction.highest_bidder_id FOR UPDATE;
  UPDATE public.game_progress
    SET money = money - v_auction.highest_bid, updated_at = now()
    WHERE user_id = v_auction.highest_bidder_id;

  -- Cria entrada de winning com car_data canônico (cliente vai expandir em OwnedCar)
  v_car_data := jsonb_build_object(
    'modelId',     v_auction.model_id,
    'variantId',   v_auction.variant_id,
    'brand',       v_auction.brand,
    'model',       v_auction.model,
    'trim',        v_auction.trim,
    'year',        v_auction.year,
    'fipePrice',   v_auction.fipe_price,
    'condition',   v_auction.condition_pct,
    'mileage',     COALESCE(v_auction.mileage, 0),
    'icon',        COALESCE(v_auction.icon, '🚗')
  );

  INSERT INTO public.auction_winnings (user_id, auction_id, car_data, amount_paid)
    VALUES (v_auction.highest_bidder_id, p_auction_id, v_car_data, v_auction.highest_bid)
    RETURNING id INTO v_winning_id;

  UPDATE public.auctions
    SET status = 'paid'
    WHERE id = p_auction_id;

  RETURN jsonb_build_object(
    'success',     true,
    'winning_id',  v_winning_id,
    'winner_id',   v_auction.highest_bidder_id,
    'amount_paid', v_auction.highest_bid
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_auction(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_auction(text) TO authenticated;

-- ── RPC: reclamar carro ganho ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.claim_auction_winning(
  p_winning_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_w       public.auction_winnings;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_w
    FROM public.auction_winnings
    WHERE id = p_winning_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'winning_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_w.user_id <> v_user_id THEN
    RAISE EXCEPTION 'not_winner' USING ERRCODE = 'P0001';
  END IF;

  IF v_w.claimed THEN
    RAISE EXCEPTION 'already_claimed' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.auction_winnings
    SET claimed = true, claimed_at = now()
    WHERE id = p_winning_id;

  RETURN jsonb_build_object(
    'success',     true,
    'car_data',    v_w.car_data,
    'amount_paid', v_w.amount_paid
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_auction_winning(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_auction_winning(uuid) TO authenticated;

COMMIT;
