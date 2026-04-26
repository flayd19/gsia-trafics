-- =====================================================================
-- PATCH_RACING.sql — Tabela de salas de corrida
-- =====================================================================

-- Tabela de salas de corrida
CREATE TABLE IF NOT EXISTS race_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','ready','finished','cancelled')),
  player1_id uuid NOT NULL,
  player1_name text NOT NULL,
  player1_car_name text NOT NULL,
  player1_igp numeric NOT NULL,
  player1_score numeric,
  player2_id uuid,
  player2_name text,
  player2_car_name text,
  player2_igp numeric,
  player2_score numeric,
  bet numeric NOT NULL,
  winner_id uuid,
  is_bot boolean NOT NULL DEFAULT false,
  seed numeric NOT NULL DEFAULT random(),
  created_at timestamptz DEFAULT now(),
  finished_at timestamptz
);

-- RLS
ALTER TABLE race_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can read race rooms"
  ON race_rooms FOR SELECT
  USING (true);

CREATE POLICY "Players can insert race rooms"
  ON race_rooms FOR INSERT
  WITH CHECK (auth.uid() = player1_id);

CREATE POLICY "Players can update race rooms"
  ON race_rooms FOR UPDATE
  USING (auth.uid() = player1_id OR auth.uid() = player2_id);

-- Índice para matchmaking rápido
CREATE INDEX IF NOT EXISTS idx_race_rooms_status_igp
  ON race_rooms(status, player1_igp)
  WHERE status = 'waiting';

-- Limpeza automática de salas antigas (opcional — pode executar via cron job)
-- DELETE FROM race_rooms WHERE created_at < now() - interval '1 hour' AND status IN ('waiting', 'cancelled');
