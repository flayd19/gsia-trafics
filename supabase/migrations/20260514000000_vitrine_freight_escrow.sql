-- =====================================================================
-- Vitrine (public marketplace), Freight calls, Escrow holds
-- Doc 06 — Multiplayer Interactions
-- =====================================================================

-- ── Vitrine offers ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vitrine_offers (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_name     text NOT NULL,
  company_id      text NOT NULL,
  company_name    text NOT NULL,
  product_id      text NOT NULL,
  product_name    text NOT NULL,
  region_id       text NOT NULL,
  total_qty       numeric(14,3) NOT NULL CHECK (total_qty > 0),
  available_qty   numeric(14,3) NOT NULL CHECK (available_qty >= 0),
  price_per_unit  numeric(14,2) NOT NULL CHECK (price_per_unit > 0),
  min_qty         numeric(14,3) NOT NULL DEFAULT 1,
  -- payment terms: 'avista' | 'parcelado'
  payment_terms   text NOT NULL DEFAULT 'avista',
  installments    int  NOT NULL DEFAULT 1 CHECK (installments BETWEEN 1 AND 12),
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','sold_out','cancelled','expired')),
  expires_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vitrine_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read vitrine"
  ON vitrine_offers FOR SELECT USING (true);

CREATE POLICY "seller manages own offers"
  ON vitrine_offers FOR ALL
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

-- ── Freight calls ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS freight_calls (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- created automatically when a vitrine purchase occurs
  origin_offer_id   uuid REFERENCES vitrine_offers(id) ON DELETE SET NULL,
  buyer_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_name        text NOT NULL,
  seller_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origin_region_id  text NOT NULL,
  dest_region_id    text NOT NULL,
  product_id        text NOT NULL,
  product_name      text NOT NULL,
  qty               numeric(14,3) NOT NULL,
  freight_value     numeric(14,2) NOT NULL,
  -- who accepted
  carrier_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  carrier_name      text,
  carrier_company_id text,
  accepted_at       timestamptz,
  -- delivery window
  expected_by       timestamptz,
  delivered_at      timestamptz,
  status            text NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open','accepted','in_transit','delivered','cancelled')),
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE freight_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read freight"
  ON freight_calls FOR SELECT USING (true);

CREATE POLICY "buyer/seller manage freight"
  ON freight_calls FOR ALL
  USING (auth.uid() IN (buyer_id, seller_id, carrier_id))
  WITH CHECK (true);

-- ── Escrow holds ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS escrow_holds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  freight_call_id uuid NOT NULL REFERENCES freight_calls(id) ON DELETE CASCADE,
  buyer_id        uuid NOT NULL REFERENCES auth.users(id),
  seller_id       uuid NOT NULL REFERENCES auth.users(id),
  carrier_id      uuid REFERENCES auth.users(id),
  product_value   numeric(14,2) NOT NULL,
  freight_value   numeric(14,2) NOT NULL DEFAULT 0,
  total_value     numeric(14,2) GENERATED ALWAYS AS (product_value + freight_value) STORED,
  status          text NOT NULL DEFAULT 'held'
                    CHECK (status IN ('held','released_seller','released_buyer','disputed')),
  released_at     timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE escrow_holds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parties read own escrow"
  ON escrow_holds FOR SELECT
  USING (auth.uid() IN (buyer_id, seller_id, carrier_id));

-- ── Payment schedules (for parcelado) ────────────────────────────────
CREATE TABLE IF NOT EXISTS payment_schedules (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id       uuid NOT NULL REFERENCES escrow_holds(id) ON DELETE CASCADE,
  installment_no  int  NOT NULL,
  amount          numeric(14,2) NOT NULL,
  due_at          timestamptz NOT NULL,
  paid_at         timestamptz,
  status          text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','paid','overdue'))
);

ALTER TABLE payment_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parties read payment_schedules"
  ON payment_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM escrow_holds e
      WHERE e.id = escrow_id
        AND auth.uid() IN (e.buyer_id, e.seller_id, e.carrier_id)
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vitrine_region   ON vitrine_offers(region_id, status);
CREATE INDEX IF NOT EXISTS idx_vitrine_product  ON vitrine_offers(product_id, status);
CREATE INDEX IF NOT EXISTS idx_freight_status   ON freight_calls(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_escrow_freight   ON escrow_holds(freight_call_id);
