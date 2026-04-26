-- =====================================================================
-- PATCH_RACING_PVP.sql — Lobby aberto PvP (até 4 jogadores)
-- Aplicar no Supabase → SQL Editor
-- =====================================================================

-- 1) Remove tabela antiga (bots/matchmaking automático)
DROP TABLE IF EXISTS public.race_rooms CASCADE;

-- 2) Cria tabela de lobbies PvP
CREATE TABLE IF NOT EXISTS public.race_lobbies (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  status        text         NOT NULL DEFAULT 'waiting'
                               CHECK (status IN ('waiting','racing','finished','cancelled')),
  host_id       uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  host_name     text         NOT NULL DEFAULT 'Jogador',
  max_players   int          NOT NULL DEFAULT 2 CHECK (max_players BETWEEN 2 AND 4),
  bet           numeric      NOT NULL CHECK (bet > 0),
  -- Array JSON de participantes:
  -- [{ userId, name, carName, carIcon, igp }]
  players       jsonb        NOT NULL DEFAULT '[]'::jsonb,
  -- Resultados após corrida:
  -- { rankings: [{ userId, name, carName, carIcon, igp, score, position, payout }] }
  results       jsonb,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  started_at    timestamptz,
  finished_at   timestamptz
);

-- 3) Habilita Realtime (necessário para subscriptions do cliente)
ALTER TABLE public.race_lobbies REPLICA IDENTITY FULL;

-- Publica a tabela no canal de Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'race_lobbies'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.race_lobbies;
  END IF;
END $$;

-- 4) RLS
ALTER TABLE public.race_lobbies ENABLE ROW LEVEL SECURITY;

-- Qualquer autenticado pode ver lobbies
CREATE POLICY "race_lobbies_select"
  ON public.race_lobbies FOR SELECT
  TO authenticated
  USING (true);

-- Host pode criar
CREATE POLICY "race_lobbies_insert"
  ON public.race_lobbies FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = host_id);

-- Updates são feitos pelas RPCs (SECURITY DEFINER) — política permissiva p/ autenticados
CREATE POLICY "race_lobbies_update"
  ON public.race_lobbies FOR UPDATE
  TO authenticated
  USING (true);

-- 5) Índice para listar lobbies abertos rapidamente
CREATE INDEX IF NOT EXISTS idx_race_lobbies_status
  ON public.race_lobbies(status, created_at DESC)
  WHERE status = 'waiting';

-- =====================================================================
-- RPC: entrar num lobby (JOIN atômico — evita race condition)
-- Retorna o lobby atualizado ou lança exceção com motivo
-- =====================================================================
CREATE OR REPLACE FUNCTION public.join_race_lobby(
  p_lobby_id uuid,
  p_player   jsonb   -- { userId, name, carName, carIcon, igp }
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lobby  record;
  v_players jsonb;
  v_len     int;
BEGIN
  -- Lock da linha para evitar concorrência
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

  -- Evita entrar duas vezes
  IF v_lobby.players @> jsonb_build_array(
       jsonb_build_object('userId', p_player->>'userId')
     ) THEN
    RAISE EXCEPTION 'already_in_lobby';
  END IF;

  v_players := v_lobby.players || jsonb_build_array(p_player);

  IF jsonb_array_length(v_players) >= v_lobby.max_players THEN
    -- Lobby completo → inicia corrida
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

-- =====================================================================
-- RPC: sair / cancelar lobby
-- =====================================================================
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
    RETURN; -- nada a fazer
  END IF;

  -- Remove o jogador do array
  SELECT jsonb_agg(elem)
    INTO v_players
    FROM jsonb_array_elements(v_lobby.players) elem
   WHERE (elem->>'userId')::uuid != v_uid;

  v_players := COALESCE(v_players, '[]'::jsonb);

  -- Se o host saiu, cancela o lobby inteiro
  IF v_lobby.host_id = v_uid OR jsonb_array_length(v_players) = 0 THEN
    UPDATE public.race_lobbies
       SET status = 'cancelled'
     WHERE id = p_lobby_id;
  ELSE
    UPDATE public.race_lobbies
       SET players = v_players
     WHERE id = p_lobby_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.leave_race_lobby(uuid) TO authenticated;

-- =====================================================================
-- RPC: salvar resultado da corrida (chamado pelo último a entrar)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.finish_race_lobby(
  p_lobby_id uuid,
  p_results  jsonb  -- { rankings: [...] }
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

-- =====================================================================
-- Limpeza automática: lobbies antigos (executar via pg_cron se disponível)
-- DELETE FROM public.race_lobbies
--   WHERE created_at < now() - interval '2 hours'
--     AND status IN ('waiting', 'cancelled', 'finished');
-- =====================================================================
