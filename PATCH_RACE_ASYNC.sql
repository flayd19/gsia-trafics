-- =====================================================================
-- PATCH_RACE_ASYNC.sql — Sistema de corrida assíncrona
-- O resultado é calculado no servidor quando o lobby lota.
-- Jogadores coletam o resultado quando voltam ao app.
-- Aplicar no Supabase → SQL Editor
-- =====================================================================

-- ── Remove função sync antiga (não usada no sistema assíncrono) ──
DROP FUNCTION IF EXISTS public.finish_race_lobby(uuid, jsonb);

-- ── Garante que race_lobbies existe ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.race_lobbies (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  status        text         NOT NULL DEFAULT 'waiting'
                               CHECK (status IN ('waiting','finished','cancelled')),
  host_id       uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host_name     text         NOT NULL DEFAULT 'Jogador',
  max_players   int          NOT NULL DEFAULT 2 CHECK (max_players BETWEEN 2 AND 4),
  bet           numeric      NOT NULL CHECK (bet > 0),
  players       jsonb        NOT NULL DEFAULT '[]'::jsonb,
  results       jsonb,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  finished_at   timestamptz
);

ALTER TABLE public.race_lobbies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.race_lobbies REPLICA IDENTITY FULL;

-- ── Migração: remove 'racing' do CHECK se vier do PATCH_COMPLETO ──
DO $$
DECLARE v_con text;
BEGIN
  SELECT conname INTO v_con
  FROM pg_constraint
  WHERE conrelid = 'public.race_lobbies'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%racing%';
  IF v_con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.race_lobbies DROP CONSTRAINT %I', v_con);
    ALTER TABLE public.race_lobbies
      ADD CONSTRAINT race_lobbies_status_check
      CHECK (status IN ('waiting','finished','cancelled'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'race_lobbies'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.race_lobbies;
  END IF;
END $$;

DROP POLICY IF EXISTS "race_lobbies_select" ON public.race_lobbies;
DROP POLICY IF EXISTS "race_lobbies_insert" ON public.race_lobbies;
DROP POLICY IF EXISTS "race_lobbies_update" ON public.race_lobbies;
DROP POLICY IF EXISTS "race_lobbies_delete" ON public.race_lobbies;

CREATE POLICY "race_lobbies_select"
  ON public.race_lobbies FOR SELECT TO authenticated USING (true);

CREATE POLICY "race_lobbies_insert"
  ON public.race_lobbies FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = host_id);

CREATE POLICY "race_lobbies_update"
  ON public.race_lobbies FOR UPDATE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_race_lobbies_status
  ON public.race_lobbies(status, created_at DESC)
  WHERE status = 'waiting';

-- ── join_race_lobby — calcula resultado no servidor quando lota ──
-- Usa hashtext determinístico: score = igp * (0.92 + hash % 160000 / 1e6)
-- Isso garante mesmo resultado para todos os jogadores.
CREATE OR REPLACE FUNCTION public.join_race_lobby(
  p_lobby_id uuid,
  p_player   jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lobby   record;
  v_players jsonb;
  v_len     int;
  v_results jsonb;
BEGIN
  SELECT * INTO v_lobby FROM public.race_lobbies WHERE id = p_lobby_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'lobby_not_found'; END IF;
  IF v_lobby.status != 'waiting' THEN RAISE EXCEPTION 'lobby_not_available'; END IF;
  IF jsonb_array_length(v_lobby.players) >= v_lobby.max_players THEN RAISE EXCEPTION 'lobby_full'; END IF;
  IF v_lobby.players @> jsonb_build_array(
       jsonb_build_object('userId', p_player->>'userId')
     ) THEN RAISE EXCEPTION 'already_in_lobby'; END IF;

  v_players := v_lobby.players || jsonb_build_array(p_player);
  v_len     := jsonb_array_length(v_players);

  IF v_len >= v_lobby.max_players THEN
    -- ── Lobby cheio: calcula resultado determinístico ────────────
    WITH
    scored AS (
      SELECT
        elem->>'userId'  AS user_id,
        elem->>'name'    AS name,
        elem->>'carName' AS car_name,
        elem->>'carIcon' AS car_icon,
        (elem->>'igp')::numeric AS igp,
        (elem->>'igp')::numeric
          * (0.92 + (abs(hashtext(p_lobby_id::text || '_' || (elem->>'userId'))) % 160000)::numeric / 1000000.0)
          AS score
      FROM jsonb_array_elements(v_players) AS elem
    ),
    ranked AS (
      SELECT *, ROW_NUMBER() OVER (ORDER BY score DESC)::int AS pos
      FROM scored
    ),
    net_pot AS (
      SELECT (v_lobby.bet * v_len * 0.9) AS val
    ),
    with_payout AS (
      SELECT r.*,
        CASE r.pos
          WHEN 1 THEN ROUND((SELECT val FROM net_pot) * 0.70)
          WHEN 2 THEN ROUND((SELECT val FROM net_pot) * 0.20)
          WHEN 3 THEN ROUND((SELECT val FROM net_pot) * 0.10)
          ELSE 0
        END AS payout
      FROM ranked r
    )
    SELECT jsonb_build_object(
      'rankings',
      jsonb_agg(
        jsonb_build_object(
          'userId',   user_id,
          'name',     name,
          'carName',  car_name,
          'carIcon',  car_icon,
          'igp',      igp,
          'score',    ROUND(score::numeric, 2),
          'position', pos,
          'payout',   payout
        ) ORDER BY pos
      )
    ) INTO v_results
    FROM with_payout;

    UPDATE public.race_lobbies
      SET players     = v_players,
          status      = 'finished',
          results     = v_results,
          finished_at = now()
    WHERE id = p_lobby_id;

  ELSE
    UPDATE public.race_lobbies SET players = v_players WHERE id = p_lobby_id;
  END IF;

  SELECT row_to_json(r.*) INTO v_lobby FROM public.race_lobbies r WHERE r.id = p_lobby_id;
  RETURN to_jsonb(v_lobby);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_race_lobby(uuid, jsonb) TO authenticated;

-- ── leave_race_lobby — host cancela; outros saem ─────────────────
CREATE OR REPLACE FUNCTION public.leave_race_lobby(p_lobby_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lobby   record;
  v_uid     uuid := auth.uid();
  v_players jsonb;
BEGIN
  SELECT * INTO v_lobby FROM public.race_lobbies
  WHERE id = p_lobby_id FOR UPDATE;

  IF NOT FOUND OR v_lobby.status != 'waiting' THEN RETURN; END IF;

  SELECT jsonb_agg(elem) INTO v_players
  FROM jsonb_array_elements(v_lobby.players) elem
  WHERE (elem->>'userId')::uuid != v_uid;

  v_players := COALESCE(v_players, '[]'::jsonb);

  IF v_lobby.host_id = v_uid OR jsonb_array_length(v_players) = 0 THEN
    UPDATE public.race_lobbies SET status = 'cancelled' WHERE id = p_lobby_id;
  ELSE
    UPDATE public.race_lobbies SET players = v_players WHERE id = p_lobby_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_race_lobby(uuid) TO authenticated;

-- ── Limpeza de lobbies antigos (opcional — rodar periodicamente) ─
-- DELETE FROM public.race_lobbies
--   WHERE created_at < now() - interval '48 hours'
--     AND status IN ('waiting','cancelled','finished');
