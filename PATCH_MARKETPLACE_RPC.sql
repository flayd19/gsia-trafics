-- =====================================================================
-- PATCH: populate_marketplace_batch
-- Resolve bug onde INSERT de carros era bloqueado por RLS.
-- Agora o insert/delete roda como SECURITY DEFINER (bypassa RLS).
-- Execute este script no Supabase SQL Editor.
-- =====================================================================

-- 1. Remove versão antiga se existir
DROP FUNCTION IF EXISTS populate_marketplace_batch(jsonb);
DROP FUNCTION IF EXISTS try_claim_marketplace_refresh();

-- 2. Nova RPC: recebe os carros gerados pelo cliente e faz o insert/delete
--    de forma atômica e sem restrição de RLS.
--    IDs são gerados SERVER-SIDE usando o batch_id real.
CREATE OR REPLACE FUNCTION populate_marketplace_batch(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_id bigint;
BEGIN
  -- Tenta ganhar o slot de refresh (atomico -- apenas 1 cliente executa)
  UPDATE marketplace_meta
  SET last_refresh = NOW(),
      batch_id     = batch_id + 1
  WHERE id = 1
    AND (last_refresh IS NULL OR last_refresh < NOW() - INTERVAL '30 minutes')
  RETURNING batch_id INTO v_batch_id;

  -- Se nao ganhou: outro jogador ja esta fazendo o refresh
  IF v_batch_id IS NULL THEN
    SELECT batch_id INTO v_batch_id FROM marketplace_meta WHERE id = 1;
    RETURN jsonb_build_object('claimed', false, 'batch_id', v_batch_id);
  END IF;

  -- Ganhou: insere os novos carros ANTES de deletar os antigos
  -- IDs gerados server-side com batch_id real para evitar conflitos
  INSERT INTO marketplace_global (
    id, model_id, variant_id, brand, model, trim, year,
    fipe_price, asking_price, condition_pct, icon, category,
    seller_name, status, buyer_name, sold_at, batch_id
  )
  SELECT
    (r->>'variant_id') || '_b' || v_batch_id || '_' || (ord - 1),
    (r->>'model_id')::text,
    (r->>'variant_id')::text,
    (r->>'brand')::text,
    (r->>'model')::text,
    (r->>'trim')::text,
    (r->>'year')::int,
    (r->>'fipe_price')::numeric,
    (r->>'asking_price')::numeric,
    (r->>'condition_pct')::int,
    (r->>'icon')::text,
    (r->>'category')::text,
    (r->>'seller_name')::text,
    'available'::text,
    NULL,
    NULL,
    v_batch_id
  FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS t(r, ord);

  -- Deleta lotes antigos somente apos insert bem-sucedido
  DELETE FROM marketplace_global WHERE batch_id < v_batch_id;

  RETURN jsonb_build_object(
    'claimed',  true,
    'batch_id', v_batch_id,
    'inserted', jsonb_array_length(p_rows)
  );
END;
$$;

-- 3. Permite que qualquer usuario (autenticado ou anon) chame a funcao
GRANT EXECUTE ON FUNCTION populate_marketplace_batch(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION populate_marketplace_batch(jsonb) TO anon;

-- 4. Reset para forcar novo inventario na proxima abertura do jogo
UPDATE marketplace_meta
SET last_refresh = '1970-01-01',
    batch_id     = 0
WHERE id = 1;

DELETE FROM marketplace_global;
