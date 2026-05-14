-- =====================================================================
-- Social Feed "O Diário" — feed_events, reactions, frequent_contacts
-- Doc 06 — Multiplayer Interactions
-- =====================================================================

-- ── Feed events ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feed_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_name text NOT NULL,
  -- event category
  event_type  text NOT NULL CHECK (event_type IN (
    'company_created',
    'company_sold',
    'big_sale',
    'big_purchase',
    'loan_taken',
    'loan_paid',
    'upgrade_applied',
    'vitrine_offer',
    'freight_delivered',
    'bank_deposit',
    'manual_post'
  )),
  -- structured payload (company name, amount, etc.)
  payload     jsonb NOT NULL DEFAULT '{}',
  -- rendered display text
  text        text NOT NULL,
  is_public   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE feed_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read feed"
  ON feed_events FOR SELECT USING (is_public = true);

CREATE POLICY "user manages own posts"
  ON feed_events FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Feed reactions ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feed_reactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id   uuid NOT NULL REFERENCES feed_events(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji      text NOT NULL DEFAULT '👍',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id, emoji)
);

ALTER TABLE feed_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read reactions"
  ON feed_reactions FOR SELECT USING (true);

CREATE POLICY "user manages own reactions"
  ON feed_reactions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Frequent contacts ─────────────────────────────────────────────────
-- Tracks how often two players interact (purchases, freight, negotiations)
CREATE TABLE IF NOT EXISTS frequent_contacts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_name    text NOT NULL,
  interaction_count int NOT NULL DEFAULT 1,
  last_interaction_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, contact_id)
);

ALTER TABLE frequent_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own contacts"
  ON frequent_contacts FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "user manages own contacts"
  ON frequent_contacts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_feed_created  ON feed_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_user     ON feed_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reactions_event ON feed_reactions(event_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user ON frequent_contacts(user_id, interaction_count DESC);
