-- =====================================================================
-- Bank accounts, loans, game calendar, company valuations
-- Doc 07 — Financial System + Calendar
-- =====================================================================

-- ── Bank accounts (virtual savings) ──────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_accounts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  balance         numeric(18,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  -- accumulated interest paid out monthly
  total_interest  numeric(18,2) NOT NULL DEFAULT 0,
  -- 0.5% per game-month (1 real day)
  monthly_rate    numeric(6,4) NOT NULL DEFAULT 0.005,
  last_interest_at timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user owns bank account"
  ON bank_accounts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Bank transactions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bank_transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text NOT NULL CHECK (type IN ('deposit','withdrawal','interest','loan_disbursement','loan_payment')),
  amount      numeric(18,2) NOT NULL,
  balance_after numeric(18,2) NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own bank transactions"
  ON bank_transactions FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user inserts own bank transactions"
  ON bank_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── Company valuations (for LTV on loans) ────────────────────────────
CREATE TABLE IF NOT EXISTS company_valuations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id  text NOT NULL,
  valuation   numeric(18,2) NOT NULL,
  valued_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE company_valuations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user owns valuations"
  ON company_valuations FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Loans ─────────────────────────────────────────────────────────────
-- PMT = P × [r(1+r)^n] / [(1+r)^n - 1]
-- 2.5%/month, max 70% of collateral company valuation
CREATE TABLE IF NOT EXISTS loans (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  collateral_company_id text NOT NULL,
  principal         numeric(18,2) NOT NULL CHECK (principal > 0),
  monthly_rate      numeric(6,4) NOT NULL DEFAULT 0.025,
  installments      int  NOT NULL CHECK (installments BETWEEN 1 AND 60),
  pmt               numeric(18,2) NOT NULL,
  total_paid        numeric(18,2) NOT NULL DEFAULT 0,
  missed_payments   int  NOT NULL DEFAULT 0,
  status            text NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','paid_off','defaulted')),
  next_payment_at   timestamptz NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user owns loans"
  ON loans FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Loan payments ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS loan_payments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id         uuid NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id),
  installment_no  int  NOT NULL,
  amount          numeric(18,2) NOT NULL,
  paid_at         timestamptz NOT NULL DEFAULT now(),
  missed          boolean NOT NULL DEFAULT false
);

ALTER TABLE loan_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own loan payments"
  ON loan_payments FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user inserts own loan payments"
  ON loan_payments FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── Game calendar state ───────────────────────────────────────────────
-- 30 min real = 1 game day; 24h real = 1 game month
CREATE TABLE IF NOT EXISTS game_calendar (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  game_day      int  NOT NULL DEFAULT 1,
  game_month    int  NOT NULL DEFAULT 1,
  game_year     int  NOT NULL DEFAULT 1,
  -- timestamps for cron triggers
  last_day_at   timestamptz NOT NULL DEFAULT now(),
  last_month_at timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE game_calendar ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user owns calendar"
  ON game_calendar FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_loans_user_status       ON loans(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bank_tx_user            ON bank_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan      ON loan_payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_valuations_user_company ON company_valuations(user_id, company_id);
