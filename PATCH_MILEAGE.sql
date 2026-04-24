-- =====================================================================
-- PATCH: Quilometragem nos carros
-- Execute no Supabase SQL Editor
-- =====================================================================

-- 1. Adiciona coluna mileage em marketplace_global
ALTER TABLE marketplace_global
  ADD COLUMN IF NOT EXISTS mileage integer NOT NULL DEFAULT 0;

-- 2. Atualiza populate_marketplace_batch para incluir mileage
DROP FUNCTION IF EXISTS populate_marketplace_batch(jsonb);

CREATE OR REPLACE FUNCTION populate_marketplace_batch(p_rows jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_batch_id bigint;
BEGIN
  UPDATE marketplace_meta
  SET last_refresh = NOW(),
      batch_id     = batch_id + 1
  WHERE id = 1
    AND (last_refresh IS NULL OR last_refresh < NOW() - INTERVAL '30 minutes')
  RETURNING batch_id INTO v_batch_id;

  IF v_batch_id IS NULL THEN
    SELECT batch_id INTO v_batch_id FROM marketplace_meta WHERE id = 1;
    RETURN jsonb_build_object('claimed', false, 'batch_id', v_batch_id);
  END IF;

  INSERT INTO marketplace_global (
    id, model_id, variant_id, brand, model, trim, year,
    fipe_price, asking_price, condition_pct, mileage, icon, category,
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
    COALESCE((r->>'mileage')::int, 0),
    (r->>'icon')::text,
    (r->>'category')::text,
    (r->>'seller_name')::text,
    'available'::text,
    NULL,
    NULL,
    v_batch_id
  FROM jsonb_array_elements(p_rows) WITH ORDINALITY AS t(r, ord);

  DELETE FROM marketplace_global WHERE batch_id < v_batch_id;

  RETURN jsonb_build_object(
    'claimed',  true,
    'batch_id', v_batch_id,
    'inserted', jsonb_array_length(p_rows)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION populate_marketplace_batch(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION populate_marketplace_batch(jsonb) TO anon;

-- 3. Reset para gerar novo inventário com quilometragem
UPDATE marketplace_meta SET last_refresh = '1970-01-01', batch_id = 0 WHERE id = 1;
DELETE FROM marketplace_global;
