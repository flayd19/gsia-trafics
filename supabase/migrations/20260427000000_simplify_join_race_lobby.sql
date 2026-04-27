-- =====================================================================
-- Migration: simplifica `join_race_lobby` removendo cálculo de score
--
-- Contexto:
--   Antes desta migration, a RPC `join_race_lobby` calculava o score de
--   cada jogador no servidor e armazenava em `race_lobbies.results`.
--   Agora, o cálculo é client-side determinístico (motor `raceEngine.ts`
--   no frontend, com seed = lobby_id), então essa lógica server-side é
--   desnecessária.
--
--   Esta versão da função apenas:
--     1. Trava a linha do lobby (FOR UPDATE) para evitar corrida.
--     2. Valida estado, jogador duplicado e capacidade.
--     3. Adiciona o jogador ao array `players` (JSONB).
--     4. Marca `status='finished'` automaticamente quando lota.
--
--   A coluna `results` é OPCIONAL: se existir, fica vazia; se não existir,
--   tudo continua funcionando.
--
-- Como aplicar:
--   Abra o SQL Editor do Supabase e execute este script INTEIRO de uma
--   só vez. O DROP + CREATE estão na mesma transação, então é atômico
--   (não há janela em que a função fique indisponível).
--
--   O DROP é necessário porque a versão antiga retornava um tipo
--   diferente (provavelmente jsonb ou void), e o Postgres não permite
--   trocar o tipo de retorno via CREATE OR REPLACE.
-- =====================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.join_race_lobby(uuid, jsonb);

CREATE FUNCTION public.join_race_lobby(
  p_lobby_id uuid,
  p_player   jsonb
)
RETURNS race_lobbies
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lobby   race_lobbies;
  v_count   int;
  v_will_lot bool;
BEGIN
  -- 1) Trava a linha do lobby — evita race condition entre dois jogadores
  --    entrando ao mesmo tempo na última vaga.
  SELECT * INTO v_lobby
    FROM race_lobbies
    WHERE id = p_lobby_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lobby_not_available' USING ERRCODE = 'P0001';
  END IF;

  -- 2) Validações de estado
  IF v_lobby.status <> 'waiting' THEN
    RAISE EXCEPTION 'lobby_not_available' USING ERRCODE = 'P0001';
  END IF;

  -- Jogador já está dentro?
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(v_lobby.players) AS p
    WHERE p->>'userId' = p_player->>'userId'
  ) THEN
    RAISE EXCEPTION 'already_in_lobby' USING ERRCODE = 'P0001';
  END IF;

  -- Cheio?
  v_count := jsonb_array_length(v_lobby.players);
  IF v_count >= v_lobby.max_players THEN
    RAISE EXCEPTION 'lobby_full' USING ERRCODE = 'P0001';
  END IF;

  v_will_lot := (v_count + 1) >= v_lobby.max_players;

  -- 3) Adiciona o jogador. Se for o último, marca como finished.
  UPDATE race_lobbies
    SET
      players     = players || jsonb_build_array(p_player),
      status      = CASE WHEN v_will_lot THEN 'finished' ELSE 'waiting' END,
      finished_at = CASE WHEN v_will_lot THEN now()      ELSE NULL      END
    WHERE id = p_lobby_id
    RETURNING * INTO v_lobby;

  RETURN v_lobby;
END;
$$;

-- Permissão: somente usuários autenticados podem chamar
REVOKE ALL ON FUNCTION public.join_race_lobby(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.join_race_lobby(uuid, jsonb) TO authenticated;

COMMIT;

-- =====================================================================
-- Limpeza opcional (rode SOMENTE depois de garantir que tudo funciona):
--
-- 1. Dropar a coluna `results` (cliente já não depende dela):
--      ALTER TABLE public.race_lobbies DROP COLUMN IF EXISTS results;
--
-- 2. Dropar a tabela legada `race_rooms` (matchmaking 1v1 antigo):
--      DROP TABLE IF EXISTS public.race_rooms CASCADE;
--
-- Faça os passos 1 e 2 só DEPOIS desta migration estar aplicada e os
-- jogadores conseguirem entrar em rachas normalmente.
-- =====================================================================
