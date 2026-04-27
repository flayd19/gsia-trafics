-- ================================================================
-- PATCH: Payout de racha — só 1º lugar ganha, taxa 5%
-- Aplique este script no Supabase SQL Editor
-- ================================================================

CREATE OR REPLACE FUNCTION join_race_lobby(
  p_lobby_id  UUID,
  p_user_id   UUID,
  p_car_igp   INT,
  p_car_model TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lobby     race_lobbies%ROWTYPE;
  v_len       INT;
  v_seed      BIGINT;
  v_result    JSONB;
BEGIN
  -- Bloqueia a linha para evitar race condition
  SELECT * INTO v_lobby
    FROM race_lobbies
    WHERE id = p_lobby_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'lobby_not_found');
  END IF;

  IF v_lobby.status <> 'waiting' THEN
    RETURN jsonb_build_object('error', 'lobby_not_waiting');
  END IF;

  -- Verifica se o usuário já está na sala
  IF EXISTS (
    SELECT 1 FROM race_lobby_players
    WHERE lobby_id = p_lobby_id AND user_id = p_user_id
  ) THEN
    RETURN jsonb_build_object('error', 'already_joined');
  END IF;

  -- Adiciona o jogador
  INSERT INTO race_lobby_players (lobby_id, user_id, car_igp, car_model)
  VALUES (p_lobby_id, p_user_id, p_car_igp, p_car_model);

  v_len := (SELECT COUNT(*) FROM race_lobby_players WHERE lobby_id = p_lobby_id);

  -- Sala lotou → resolve a corrida
  IF v_len >= v_lobby.max_players THEN

    -- Seed determinístico a partir do id da sala
    v_seed := abs(hashtext(p_lobby_id::text));

    -- Calcula posições: IGP + ruído pseudo-aleatório por posição na seed
    WITH players AS (
      SELECT
        user_id,
        car_igp,
        car_model,
        ROW_NUMBER() OVER () AS slot
      FROM race_lobby_players
      WHERE lobby_id = p_lobby_id
      ORDER BY created_at
    ),
    scored AS (
      SELECT
        user_id,
        car_igp,
        car_model,
        -- Ruído: até ±15% do IGP, determinístico por seed + slot
        car_igp + (((v_seed * (slot * 2654435761)) >> 16) % GREATEST(1, car_igp / 7))
          - (car_igp / 14) AS score
      FROM players
    ),
    ranked AS (
      SELECT *,
        RANK() OVER (ORDER BY score DESC) AS pos
      FROM scored
    ),
    net_pot AS (
      -- 5% de taxa do sistema; 95% vai integralmente para o 1º lugar
      SELECT (v_lobby.bet * v_len * 0.95)::BIGINT AS val
    ),
    with_payout AS (
      SELECT r.*,
        CASE r.pos
          WHEN 1 THEN (SELECT val FROM net_pot)
          ELSE 0
        END AS payout
      FROM ranked r
    )
    -- Atualiza payouts na tabela de jogadores
    UPDATE race_lobby_players rlp
    SET
      position = wp.pos,
      payout   = wp.payout,
      score    = wp.score
    FROM with_payout wp
    WHERE rlp.lobby_id = p_lobby_id
      AND rlp.user_id  = wp.user_id;

    -- Marca o lobby como finalizado
    UPDATE race_lobbies
    SET status     = 'finished',
        finished_at = NOW()
    WHERE id = p_lobby_id;

    -- Retorna resultado completo da corrida
    SELECT jsonb_build_object(
      'status',  'finished',
      'players', jsonb_agg(
        jsonb_build_object(
          'userId',   rlp.user_id,
          'carModel', rlp.car_model,
          'carIgp',   rlp.car_igp,
          'score',    rlp.score,
          'position', rlp.position,
          'payout',   rlp.payout
        ) ORDER BY rlp.position
      )
    )
    INTO v_result
    FROM race_lobby_players rlp
    WHERE rlp.lobby_id = p_lobby_id;

    RETURN v_result;
  END IF;

  -- Sala ainda não lotou
  RETURN jsonb_build_object('status', 'waiting', 'players', v_len);
END;
$$;
