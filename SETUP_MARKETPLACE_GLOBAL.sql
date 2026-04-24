-- ================================================================
-- GSIA CARROS — Setup do Marketplace Global
-- Cole este arquivo inteiro no SQL Editor do Supabase e execute.
-- Seguro para rodar várias vezes (CREATE IF NOT EXISTS / OR REPLACE).
-- ================================================================

-- ── marketplace_meta ─────────────────────────────────────────────
-- Singleton que controla qual batch está ativo e quando foi gerado.
CREATE TABLE IF NOT EXISTS marketplace_meta (
  id           int  PRIMARY KEY DEFAULT 1,
  last_refresh timestamptz NOT NULL DEFAULT '1970-01-01',
  batch_id     bigint      NOT NULL DEFAULT 0,
  CONSTRAINT singleton CHECK (id = 1)
);

-- Garante que a linha singleton existe
INSERT INTO marketplace_meta (id, last_refresh, batch_id)
VALUES (1, '1970-01-01', 0)
ON CONFLICT (id) DO NOTHING;

-- ── marketplace_global ───────────────────────────────────────────
-- Inventário compartilhado entre todos os jogadores.
CREATE TABLE IF NOT EXISTS marketplace_global (
  id            text        PRIMARY KEY,
  model_id      text        NOT NULL,
  variant_id    text        NOT NULL,
  brand         text        NOT NULL,
  model         text        NOT NULL,
  trim          text        NOT NULL,
  year          int         NOT NULL,
  fipe_price    numeric     NOT NULL,
  asking_price  numeric     NOT NULL,
  condition_pct int         NOT NULL,
  icon          text        NOT NULL DEFAULT '',
  category      text        NOT NULL,
  seller_name   text        NOT NULL DEFAULT 'NPC',
  status        text        NOT NULL DEFAULT 'available'
                CHECK (status IN ('available', 'sold')),
  buyer_name    text,
  sold_at       timestamptz,
  batch_id      bigint      NOT NULL DEFAULT 0
);

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_mg_status    ON marketplace_global (status);
CREATE INDEX IF NOT EXISTS idx_mg_batch     ON marketplace_global (batch_id);
CREATE INDEX IF NOT EXISTS idx_mg_category  ON marketplace_global (category);

-- Habilita Realtime nessa tabela (propagação instantânea de vendas)
ALTER TABLE marketplace_global REPLICA IDENTITY FULL;

-- ── RLS ──────────────────────────────────────────────────────────
-- Qualquer jogador autenticado pode ler o inventário.
ALTER TABLE marketplace_global ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_meta   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "marketplace_global_select" ON marketplace_global;
CREATE POLICY "marketplace_global_select"
  ON marketplace_global FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "marketplace_meta_select" ON marketplace_meta;
CREATE POLICY "marketplace_meta_select"
  ON marketplace_meta FOR SELECT
  TO authenticated
  USING (true);

-- Jogadores autenticados podem inserir e deletar carros do inventário global
-- (necessário para o cliente popular o lote após try_claim_marketplace_refresh)
DROP POLICY IF EXISTS "marketplace_global_insert" ON marketplace_global;
CREATE POLICY "marketplace_global_insert"
  ON marketplace_global FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "marketplace_global_delete" ON marketplace_global;
CREATE POLICY "marketplace_global_delete"
  ON marketplace_global FOR DELETE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "marketplace_global_update" ON marketplace_global;
CREATE POLICY "marketplace_global_update"
  ON marketplace_global FOR UPDATE
  TO authenticated
  USING (true);

-- ── try_claim_marketplace_refresh() ──────────────────────────────
-- Tenta "ganhar" o slot de refresh de forma atômica.
-- Retorna o novo batch_id se ganhou, NULL se outro jogador já atualizou.
DROP FUNCTION IF EXISTS try_claim_marketplace_refresh();
CREATE OR REPLACE FUNCTION try_claim_marketplace_refresh()
RETURNS bigint
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_row       marketplace_meta%ROWTYPE;
  v_new_batch bigint;
BEGIN
  -- Lê o estado atual com lock
  SELECT * INTO v_row FROM marketplace_meta WHERE id = 1 FOR UPDATE;

  -- Só atualiza se de fato estiver stale (>= 30 min)
  IF v_row.last_refresh > (now() - INTERVAL '30 minutes') THEN
    RETURN NULL;  -- outro jogador já fez o refresh
  END IF;

  v_new_batch := v_row.batch_id + 1;

  UPDATE marketplace_meta
  SET last_refresh = now(),
      batch_id     = v_new_batch
  WHERE id = 1;

  RETURN v_new_batch;
END;
$$;

GRANT EXECUTE ON FUNCTION try_claim_marketplace_refresh() TO authenticated;

-- ── buy_marketplace_car(p_car_id, p_buyer_name) ───────────────────
-- Compra atômica: só tem sucesso se o carro ainda estiver disponível.
DROP FUNCTION IF EXISTS buy_marketplace_car(text, text);
CREATE OR REPLACE FUNCTION buy_marketplace_car(
  p_car_id    text,
  p_buyer_name text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_car marketplace_global%ROWTYPE;
BEGIN
  -- Trava a linha para evitar dupla compra
  SELECT * INTO v_car
  FROM marketplace_global
  WHERE id = p_car_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Carro não encontrado.');
  END IF;

  IF v_car.status = 'sold' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Este carro já foi vendido por outro jogador!');
  END IF;

  UPDATE marketplace_global
  SET status     = 'sold',
      buyer_name = p_buyer_name,
      sold_at    = now()
  WHERE id = p_car_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', v_car.brand || ' ' || v_car.model || ' é seu!'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION buy_marketplace_car(text, text) TO authenticated;

-- ── Realtime publication ──────────────────────────────────────────
-- Adiciona marketplace_global ao canal de Realtime do Supabase.
-- (Só tem efeito se a publicação "supabase_realtime" existir.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE marketplace_global;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
