-- =====================================================================
-- Upgrade catalog, company upgrades, company employees
-- Doc 04v2 — Modular Progression System
-- =====================================================================

-- ── Upgrade catalog ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS upgrade_catalog (
  id              text PRIMARY KEY,
  company_type_id text NOT NULL,
  -- 'equipment' | 'structure' | 'employee_slot' | 'permanent_unlock'
  category        text NOT NULL CHECK (category IN ('equipment','structure','employee_slot','permanent_unlock')),
  tier            int  NOT NULL DEFAULT 1 CHECK (tier BETWEEN 1 AND 5),
  name            text NOT NULL,
  description     text NOT NULL,
  cost            numeric(14,2) NOT NULL CHECK (cost > 0),
  -- requires_upgrade_id: must own this upgrade first (NULL = no prereq)
  requires_id     text REFERENCES upgrade_catalog(id),
  -- game effects encoded as JSON
  -- e.g. {"production_speed": 0.2, "capacity": 500, "employee_limit": 2}
  effects         jsonb NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE upgrade_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read catalog"
  ON upgrade_catalog FOR SELECT USING (true);

-- ── Company upgrades (purchased upgrades per company instance) ────────
CREATE TABLE IF NOT EXISTS company_upgrades (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id      text NOT NULL,
  upgrade_id      text NOT NULL REFERENCES upgrade_catalog(id),
  purchased_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id, upgrade_id)
);

ALTER TABLE company_upgrades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user owns company upgrades"
  ON company_upgrades FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Company employees ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_employees (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id      text NOT NULL,
  role            text NOT NULL DEFAULT 'operario'
                    CHECK (role IN ('operario','tecnico','gerente','diretor')),
  name            text NOT NULL DEFAULT 'Funcionário',
  salary          numeric(14,2) NOT NULL DEFAULT 1500,
  hired_at        timestamptz NOT NULL DEFAULT now(),
  -- active | dismissed
  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','dismissed'))
);

ALTER TABLE company_employees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user owns employees"
  ON company_employees FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Seed upgrade catalog ──────────────────────────────────────────────
-- Sample upgrades for mina_ferro (iron mine) — expandable to all types

INSERT INTO upgrade_catalog (id, company_type_id, category, tier, name, description, cost, effects)
VALUES
  -- Equipment
  ('mina_ferro_equip_1', 'mina_ferro', 'equipment', 1,
   'Britador Pequeno', 'Aumenta produção em 20% por ciclo.',
   8000, '{"production_multiplier": 1.2}'),

  ('mina_ferro_equip_2', 'mina_ferro', 'equipment', 2,
   'Britador Industrial', 'Aumenta produção em 50% por ciclo.',
   25000, '{"production_multiplier": 1.5}'),

  ('mina_ferro_equip_3', 'mina_ferro', 'equipment', 3,
   'Linha de Beneficiamento', 'Dobra a produção por ciclo.',
   80000, '{"production_multiplier": 2.0}'),

  -- Structure
  ('mina_ferro_struct_1', 'mina_ferro', 'structure', 1,
   'Galpão de Armazenagem', 'Aumenta capacidade de estoque em 500 t.',
   12000, '{"storage_bonus": 500}'),

  ('mina_ferro_struct_2', 'mina_ferro', 'structure', 2,
   'Silo Metálico', 'Aumenta capacidade de estoque em 2000 t.',
   45000, '{"storage_bonus": 2000}'),

  -- Employee slots
  ('mina_ferro_emp_1', 'mina_ferro', 'employee_slot', 1,
   'Vaga de Operário', 'Permite contratar 1 operário (reduz ciclo em 5%).',
   5000, '{"employee_slots": 1, "cycle_reduction": 0.05}'),

  ('mina_ferro_emp_2', 'mina_ferro', 'employee_slot', 2,
   'Vaga de Técnico', 'Permite contratar 1 técnico (reduz ciclo em 10%).',
   15000, '{"employee_slots": 1, "cycle_reduction": 0.10}'),

  -- Permanent unlock
  ('mina_ferro_unlock_qualidade', 'mina_ferro', 'permanent_unlock', 1,
   'Certificação de Qualidade', 'Desbloqueia venda direta para siderúrgicas (+15% preço).',
   30000, '{"sell_price_bonus": 0.15, "unlocks": "direct_to_siderurgica"}')

ON CONFLICT (id) DO NOTHING;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_catalog_type     ON upgrade_catalog(company_type_id, tier);
CREATE INDEX IF NOT EXISTS idx_upgrades_company ON company_upgrades(user_id, company_id);
CREATE INDEX IF NOT EXISTS idx_employees_company ON company_employees(user_id, company_id, status);
