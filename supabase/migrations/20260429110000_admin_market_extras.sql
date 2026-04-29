-- =====================================================================
-- Migration: extras do mercado no painel admin
--   • admin_market_config ganha min_batch / max_batch (controle de quantidade)
--   • RPC admin_get_full_market_config — retorna config completa
--   • RPC admin_force_market_full_regen — regenera batch completo no servidor
--     (limpa marketplace_global + reseta meta + retorna instruções para client)
--   • RPC admin_clear_marketplace — apaga inventário disponível atual
-- =====================================================================

BEGIN;

-- ── Estende admin_market_config ────────────────────────────────────
ALTER TABLE public.admin_market_config
  ADD COLUMN IF NOT EXISTS min_batch int NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS max_batch int NOT NULL DEFAULT 1200,
  ADD COLUMN IF NOT EXISTS popular_min_ratio numeric NOT NULL DEFAULT 0.40,
  ADD COLUMN IF NOT EXISTS max_same_model int NOT NULL DEFAULT 4;

ALTER TABLE public.admin_market_config
  ADD CONSTRAINT admin_market_config_batch_range_chk
  CHECK (min_batch > 0 AND max_batch >= min_batch AND max_batch <= 5000);

-- ── RPC: get_full_market_config ────────────────────────────────────
-- Acessível por qualquer authenticated (cliente precisa ler para popular).
CREATE OR REPLACE FUNCTION public.get_full_market_config()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_cfg public.admin_market_config;
BEGIN
  SELECT * INTO v_cfg FROM public.admin_market_config WHERE id = 1;
  IF v_cfg IS NULL THEN
    RETURN jsonb_build_object(
      'category_weights',  '{}'::jsonb,
      'min_batch',         1000,
      'max_batch',         1200,
      'popular_min_ratio', 0.40,
      'max_same_model',    4
    );
  END IF;
  RETURN jsonb_build_object(
    'category_weights',  v_cfg.category_weights,
    'min_batch',         v_cfg.min_batch,
    'max_batch',         v_cfg.max_batch,
    'popular_min_ratio', v_cfg.popular_min_ratio,
    'max_same_model',    v_cfg.max_same_model,
    'updated_at',        v_cfg.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_full_market_config() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_full_market_config() TO authenticated;

-- ── RPC: admin_update_full_market_config ───────────────────────────
-- Substitui admin_update_market_config (que só salvava pesos). Esta
-- versão atualiza pesos + min/max + popular_min_ratio em uma chamada.
CREATE OR REPLACE FUNCTION public.admin_update_full_market_config(
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
DECLARE
  v_total numeric;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;

  -- Validações defensivas
  IF jsonb_typeof(p_weights) <> 'object' THEN
    RAISE EXCEPTION 'weights_must_be_object' USING ERRCODE = 'P0001';
  END IF;

  -- Soma dos pesos: tolera 99-101 (arredondamento de slider)
  SELECT COALESCE(SUM((value)::numeric), 0)
    INTO v_total
    FROM jsonb_each_text(p_weights);

  IF v_total < 99 OR v_total > 101 THEN
    RAISE EXCEPTION 'weights_must_sum_to_100 (got %)', v_total USING ERRCODE = 'P0001';
  END IF;

  IF p_min_batch <= 0 OR p_min_batch > p_max_batch OR p_max_batch > 5000 THEN
    RAISE EXCEPTION 'invalid_batch_range' USING ERRCODE = 'P0001';
  END IF;

  IF p_popular_min_ratio IS NOT NULL AND
     (p_popular_min_ratio < 0 OR p_popular_min_ratio > 1) THEN
    RAISE EXCEPTION 'invalid_popular_min_ratio' USING ERRCODE = 'P0001';
  END IF;

  IF p_max_same_model IS NOT NULL AND
     (p_max_same_model < 1 OR p_max_same_model > 100) THEN
    RAISE EXCEPTION 'invalid_max_same_model' USING ERRCODE = 'P0001';
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

REVOKE ALL ON FUNCTION public.admin_update_full_market_config(jsonb, int, int, numeric, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_full_market_config(jsonb, int, int, numeric, int) TO authenticated;

-- ── RPC: admin_clear_marketplace ───────────────────────────────────
-- Apaga TODOS os carros disponíveis (status='available') do marketplace_global.
-- Não toca em vendidos (histórico). Atualiza o batch_id para invalidar listas
-- antigas em clientes.
CREATE OR REPLACE FUNCTION public.admin_clear_marketplace()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted   int;
  v_new_batch bigint;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not_admin' USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.marketplace_global WHERE status = 'available';
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  UPDATE public.marketplace_meta
    SET batch_id     = COALESCE(batch_id, 0) + 1,
        last_refresh = NULL
    WHERE id = 1
    RETURNING batch_id INTO v_new_batch;

  RETURN jsonb_build_object(
    'deleted',     v_deleted,
    'new_batch_id', COALESCE(v_new_batch, 0)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_clear_marketplace() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_clear_marketplace() TO authenticated;

COMMIT;
