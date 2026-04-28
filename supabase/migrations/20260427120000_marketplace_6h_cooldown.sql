-- =====================================================================
-- Migration: cooldown de 6h no mercado global, validado no servidor
--
-- Problema:
--   O mercado estava atualizando em ~30 min em vez do intervalo configurado.
--   Causa: a RPC populate_marketplace_batch antiga aceitava qualquer
--   chamada que passasse pela checagem de "claim", e diferentes clientes
--   tentavam regenerar de forma descoordenada quando o frontend estava
--   com lógica diferente do servidor.
--
-- Solução:
--   • Validação rígida no SERVIDOR (não confia no cliente).
--   • Travamento com FOR UPDATE da linha marketplace_meta para evitar race.
--   • Cooldown FIXO de 6h: rejeita qualquer tentativa antes do prazo.
--   • Retorna { claimed, batch_id, next_refresh_at } para o cliente saber
--     se a regeneração foi aplicada e quando o próximo refresh é permitido.
--
-- Como aplicar:
--   Cole este script no SQL Editor do Supabase e clique Run. É uma
--   transação atômica (BEGIN/COMMIT) — se algo falhar, nada muda.
-- =====================================================================

BEGIN;

-- Garante que a tabela marketplace_meta exista com a estrutura esperada.
CREATE TABLE IF NOT EXISTS public.marketplace_meta (
  id            int PRIMARY KEY DEFAULT 1,
  last_refresh  timestamptz,
  batch_id      bigint NOT NULL DEFAULT 0,
  CHECK (id = 1)
);

INSERT INTO public.marketplace_meta (id, last_refresh, batch_id)
  VALUES (1, NULL, 0)
  ON CONFLICT (id) DO NOTHING;

-- Garante que a tabela marketplace_global existe (defensivo).
CREATE TABLE IF NOT EXISTS public.marketplace_global (
  id            text PRIMARY KEY,
  model_id      text NOT NULL,
  variant_id    text NOT NULL,
  brand         text NOT NULL,
  model         text NOT NULL,
  trim          text,
  year          int  NOT NULL,
  fipe_price    numeric NOT NULL,
  asking_price  numeric NOT NULL,
  condition_pct int NOT NULL,
  mileage       int,
  icon          text,
  category      text,
  seller_name   text,
  status        text NOT NULL DEFAULT 'available',
  buyer_name    text,
  sold_at       timestamptz,
  batch_id      bigint NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Drop existente (caso haja assinatura diferente)
DROP FUNCTION IF EXISTS public.populate_marketplace_batch(jsonb[]);
DROP FUNCTION IF EXISTS public.populate_marketplace_batch(jsonb);

-- ── RPC: popula novo batch com cooldown de 6h ───────────────────────
CREATE OR REPLACE FUNCTION public.populate_marketplace_batch(
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
  v_cooldown_secs   int := 6 * 60 * 60;  -- 6 horas (FIXO no servidor)
  v_age_secs        numeric;
  v_new_batch_id    bigint;
  v_inserted_count  int := 0;
  v_row             jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = 'P0001';
  END IF;

  -- Trava a meta-row para evitar race entre clientes
  SELECT * INTO v_meta
    FROM public.marketplace_meta
    WHERE id = 1
    FOR UPDATE;

  -- Cooldown check: se passaram menos de 6h, REJEITA a regeneração
  IF v_meta.last_refresh IS NOT NULL THEN
    v_age_secs := EXTRACT(EPOCH FROM (v_now - v_meta.last_refresh));
    IF v_age_secs < v_cooldown_secs THEN
      -- Regeneração não permitida — retorna o batch_id atual sem mudanças
      RETURN jsonb_build_object(
        'claimed',         false,
        'batch_id',        v_meta.batch_id,
        'next_refresh_at', v_meta.last_refresh + (v_cooldown_secs || ' seconds')::interval,
        'reason',          'cooldown_active',
        'remaining_secs',  v_cooldown_secs - v_age_secs::int
      );
    END IF;
  END IF;

  -- Cooldown ok ou primeira execução — claim do refresh
  v_new_batch_id := COALESCE(v_meta.batch_id, 0) + 1;

  UPDATE public.marketplace_meta
    SET last_refresh = v_now,
        batch_id     = v_new_batch_id
    WHERE id = 1;

  -- Limpa carros disponíveis do batch anterior (mantém vendidos para histórico)
  DELETE FROM public.marketplace_global
    WHERE status = 'available' AND batch_id < v_new_batch_id;

  -- Insere o novo batch (sobrescreve batch_id no servidor)
  IF jsonb_typeof(p_rows) = 'array' THEN
    FOR v_row IN SELECT * FROM jsonb_array_elements(p_rows) LOOP
      INSERT INTO public.marketplace_global (
        id, model_id, variant_id, brand, model, trim, year,
        fipe_price, asking_price, condition_pct, mileage,
        icon, category, seller_name, status, batch_id
      )
      VALUES (
        REPLACE(v_row->>'id', '_b0_', '_b' || v_new_batch_id || '_'),
        v_row->>'model_id', v_row->>'variant_id',
        v_row->>'brand', v_row->>'model', v_row->>'trim',
        (v_row->>'year')::int,
        (v_row->>'fipe_price')::numeric,
        (v_row->>'asking_price')::numeric,
        (v_row->>'condition_pct')::int,
        NULLIF(v_row->>'mileage', '')::int,
        v_row->>'icon', v_row->>'category', v_row->>'seller_name',
        COALESCE(v_row->>'status', 'available'),
        v_new_batch_id
      )
      ON CONFLICT (id) DO NOTHING;
      v_inserted_count := v_inserted_count + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'claimed',         true,
    'batch_id',        v_new_batch_id,
    'inserted',        v_inserted_count,
    'next_refresh_at', v_now + (v_cooldown_secs || ' seconds')::interval
  );
END;
$$;

REVOKE ALL ON FUNCTION public.populate_marketplace_batch(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.populate_marketplace_batch(jsonb) TO authenticated;

COMMIT;

-- =====================================================================
-- Verificação rápida (rode isso depois para confirmar):
--
--   SELECT id, last_refresh,
--          (last_refresh + interval '6 hours') AS next_refresh_at,
--          batch_id
--   FROM public.marketplace_meta;
--
-- Se quiser FORÇAR um refresh único agora (admin):
--   UPDATE public.marketplace_meta SET last_refresh = NULL WHERE id = 1;
--
-- =====================================================================
