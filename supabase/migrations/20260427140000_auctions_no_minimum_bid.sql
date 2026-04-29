-- =====================================================================
-- Migration: remover lance mínimo dos leilões
--
-- Mudança:
--   • Antes: lance mínimo era 50% da FIPE (sem lances) ou +1% sobre o atual.
--   • Agora: qualquer valor positivo é aceito como lance inicial. Lances
--     subsequentes só precisam ser MAIORES que o atual (qualquer incremento).
--
-- Como aplicar: cole no SQL Editor e execute.
-- =====================================================================

BEGIN;

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

  -- Sem lance mínimo: qualquer valor positivo passa se for maior que o atual.
  -- O lance só precisa ser ESTRITAMENTE maior que o highest_bid atual.
  IF v_auction.highest_bid IS NOT NULL AND p_amount <= v_auction.highest_bid THEN
    RAISE EXCEPTION 'bid_too_low' USING ERRCODE = 'P0001';
  END IF;

  -- Verifica saldo disponível (cheque especial padrão até -50000)
  SELECT money INTO v_user_money
    FROM public.game_progress
    WHERE user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0001';
  END IF;

  IF v_user_money - p_amount < -50000 THEN
    RAISE EXCEPTION 'insufficient_balance' USING ERRCODE = 'P0001';
  END IF;

  SELECT display_name INTO v_user_name
    FROM public.player_profiles
    WHERE user_id = v_user_id;
  v_user_name := COALESCE(v_user_name, 'Jogador');

  UPDATE public.auctions
    SET highest_bid         = p_amount,
        highest_bidder_id   = v_user_id,
        highest_bidder_name = v_user_name,
        bid_count           = bid_count + 1
    WHERE id = p_auction_id;

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

COMMIT;
