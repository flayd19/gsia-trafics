-- =====================================================================
-- PATCH_COMPLETO.sql — Patch único definitivo
-- Inclui: race_lobbies PvP + RLS ranking + races_won + v_ranking final
-- Aplicar no Supabase → SQL Editor (substitui todos os patches anteriores)
-- =====================================================================

-- ══════════════════════════════════════════════════════════════════
-- 1) TABELA DE LOBBIES PvP (race_lobbies)
-- ══════════════════════════════════════════════════════════════════

DROP TABLE IF EXISTS public.race_rooms CASCADE;

CREATE TABLE IF NOT EXISTS public.race_lobbies (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  status        text         NOT NULL DEFAULT 'waiting'
                               CHECK (status IN ('waiting','racing','finished','cancelled')),
  host_id       uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host_name     text         NOT NULL DEFAULT 'Jogador',
  max_players   int          NOT NULL DEFAULT 2 CHECK (max_players BETWEEN 2 AND 4),
  bet           numeric      NOT NULL CHECK (bet > 0),
  players       jsonb        NOT NULL DEFAULT '[]'::jsonb,
  results       jsonb,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  started_at    timestamptz,
  finished_at   timestamptz
);

ALTER TABLE public.race_lobbies ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.race_lobbies REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'race_lobbies'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.race_lobbies;
  END IF;
END $$;

-- RLS race_lobbies
DROP POLICY IF EXISTS "race_lobbies_select" ON public.race_lobbies;
DROP POLICY IF EXISTS "race_lobbies_insert" ON public.race_lobbies;
DROP POLICY IF EXISTS "race_lobbies_update" ON public.race_lobbies;

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

-- ══════════════════════════════════════════════════════════════════
-- 2) RPCs DE LOBBY
-- ══════════════════════════════════════════════════════════════════

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
BEGIN
  SELECT * INTO v_lobby
    FROM public.race_lobbies
   WHERE id = p_lobby_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lobby_not_found';
  END IF;

  IF v_lobby.status != 'waiting' THEN
    RAISE EXCEPTION 'lobby_not_available';
  END IF;

  v_len := jsonb_array_length(v_lobby.players);

  IF v_len >= v_lobby.max_players THEN
    RAISE EXCEPTION 'lobby_full';
  END IF;

  IF v_lobby.players @> jsonb_build_array(
       jsonb_build_object('userId', p_player->>'userId')
     ) THEN
    RAISE EXCEPTION 'already_in_lobby';
  END IF;

  v_players := v_lobby.players || jsonb_build_array(p_player);

  IF jsonb_array_length(v_players) >= v_lobby.max_players THEN
    UPDATE public.race_lobbies
       SET players    = v_players,
           status     = 'racing',
           started_at = now()
     WHERE id = p_lobby_id;
  ELSE
    UPDATE public.race_lobbies
       SET players = v_players
     WHERE id = p_lobby_id;
  END IF;

  SELECT row_to_json(r.*) INTO v_lobby
    FROM public.race_lobbies r
   WHERE r.id = p_lobby_id;

  RETURN to_jsonb(v_lobby);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_race_lobby(uuid, jsonb) TO authenticated;

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
  SELECT * INTO v_lobby
    FROM public.race_lobbies
   WHERE id = p_lobby_id
     FOR UPDATE;

  IF NOT FOUND OR v_lobby.status NOT IN ('waiting') THEN
    RETURN;
  END IF;

  SELECT jsonb_agg(elem)
    INTO v_players
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

CREATE OR REPLACE FUNCTION public.finish_race_lobby(
  p_lobby_id uuid,
  p_results  jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.race_lobbies
     SET status      = 'finished',
         results     = p_results,
         finished_at = now()
   WHERE id = p_lobby_id
     AND status = 'racing';
END;
$$;

GRANT EXECUTE ON FUNCTION public.finish_race_lobby(uuid, jsonb) TO authenticated;

-- ══════════════════════════════════════════════════════════════════
-- 3) PLAYER_PROFILES — colunas + RLS
-- ══════════════════════════════════════════════════════════════════

ALTER TABLE public.player_profiles
  ADD COLUMN IF NOT EXISTS display_name text;

ALTER TABLE public.player_profiles
  ADD COLUMN IF NOT EXISTS races_won integer NOT NULL DEFAULT 0;

ALTER TABLE public.player_profiles
  ALTER COLUMN total_patrimony SET DEFAULT 0;

ALTER TABLE public.player_profiles
  ALTER COLUMN level SET DEFAULT 1;

-- RLS: qualquer autenticado lê todos os perfis (para ranking)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.player_profiles;
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.player_profiles;

CREATE POLICY "Authenticated users can view all profiles"
  ON public.player_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Realtime
ALTER TABLE public.player_profiles REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'player_profiles'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.player_profiles;
  END IF;
END $$;

-- ══════════════════════════════════════════════════════════════════
-- 4) BACKFILL display_name, total_patrimony, level
-- ══════════════════════════════════════════════════════════════════

UPDATE public.player_profiles pp
SET display_name = COALESCE(
  NULLIF(trim(pp.display_name), ''),
  split_part(coalesce(u.email, ''), '@', 1),
  'Jogador'
)
FROM auth.users u
WHERE pp.user_id = u.id
  AND (pp.display_name IS NULL OR trim(pp.display_name) = '');

UPDATE public.player_profiles pp
SET total_patrimony = GREATEST(
  COALESCE(pp.total_patrimony, 0),
  COALESCE(gp.money, 0),
  COALESCE((gp.car_game_data->>'money')::decimal, 0)
)
FROM public.game_progress gp
WHERE pp.user_id = gp.user_id
  AND COALESCE(pp.total_patrimony, 0) = 0
  AND gp.car_game_data IS NOT NULL;

UPDATE public.player_profiles pp
SET level = GREATEST(
  COALESCE(pp.level, 1),
  COALESCE((gp.car_game_data->'reputation'->>'level')::integer, 1)
)
FROM public.game_progress gp
WHERE pp.user_id = gp.user_id
  AND gp.car_game_data IS NOT NULL
  AND (gp.car_game_data->'reputation'->>'level')::integer > COALESCE(pp.level, 1);

-- ══════════════════════════════════════════════════════════════════
-- 5) VIEW v_ranking (com races_won)
-- ══════════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS public.v_ranking;

CREATE VIEW public.v_ranking AS
SELECT
  pp.user_id,
  COALESCE(NULLIF(trim(pp.display_name), ''), 'Jogador') AS display_name,
  COALESCE(pp.total_patrimony, 0)                        AS total_patrimony,
  COALESCE(pp.level, 1)                                  AS level,
  COALESCE(pp.races_won, 0)                              AS races_won,
  pp.updated_at
FROM public.player_profiles pp
ORDER BY pp.total_patrimony DESC NULLS LAST;

GRANT SELECT ON public.v_ranking TO authenticated;

-- ══════════════════════════════════════════════════════════════════
-- 6) save_car_game (com races_won)
-- ══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.save_car_game(p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualiza game_progress
  UPDATE public.game_progress
  SET
    car_game_data = p_data,
    money         = (p_data->>'money')::decimal,
    updated_at    = now()
  WHERE user_id = auth.uid();

  IF NOT FOUND THEN
    INSERT INTO public.game_progress (user_id, car_game_data, money)
    VALUES (
      auth.uid(),
      p_data,
      COALESCE((p_data->>'money')::decimal, 30000)
    );
  END IF;

  -- Atualiza player_profiles (ranking)
  UPDATE public.player_profiles
  SET
    total_patrimony = GREATEST(
      COALESCE(
        NULLIF((p_data->>'total_patrimony')::decimal, 0),
        (p_data->>'money')::decimal,
        0
      ),
      0
    ),
    display_name = COALESCE(
      NULLIF(trim(p_data->>'display_name'), ''),
      display_name
    ),
    level      = COALESCE((p_data->'reputation'->>'level')::integer, level, 1),
    races_won  = COALESCE((p_data->>'races_won')::integer, races_won, 0),
    updated_at = now()
  WHERE user_id = auth.uid();

  -- Cria novo perfil se não existia
  INSERT INTO public.player_profiles (user_id, display_name, total_patrimony, level, races_won)
  SELECT
    auth.uid(),
    COALESCE(NULLIF(trim(p_data->>'display_name'), ''), 'Jogador'),
    COALESCE(NULLIF((p_data->>'total_patrimony')::decimal, 0), (p_data->>'money')::decimal, 0),
    COALESCE((p_data->'reputation'->>'level')::integer, 1),
    COALESCE((p_data->>'races_won')::integer, 0)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.player_profiles WHERE user_id = auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_car_game(jsonb) TO authenticated;

-- ══════════════════════════════════════════════════════════════════
-- 7) Verificação final
-- ══════════════════════════════════════════════════════════════════

SELECT
  count(*)                                          AS total_jogadores,
  count(*) FILTER (WHERE total_patrimony > 0)       AS com_patrimonio,
  count(*) FILTER (WHERE display_name IS NOT NULL)  AS com_nome,
  count(*) FILTER (WHERE races_won > 0)             AS com_rachas_vencidos
FROM public.player_profiles;
