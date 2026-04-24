-- =====================================================================
-- GSIA Carros — Save System
-- Adiciona coluna car_game_data ao game_progress existente
-- + RPCs de salvar/carregar progresso do jogo de carros
-- =====================================================================

-- 1) Coluna de save no game_progress já existente
-- (idempotente — não faz nada se já existir)
ALTER TABLE public.game_progress
  ADD COLUMN IF NOT EXISTS car_game_data jsonb DEFAULT NULL;

-- Índice para acelerar lookup por user_id (já deve existir, mas garantimos)
CREATE UNIQUE INDEX IF NOT EXISTS game_progress_user_id_idx
  ON public.game_progress (user_id);

-- =====================================================================
-- 2) RPC: salvar progresso
-- Chamada pelo cliente a cada 30s e nos eventos importantes
-- (compra, venda, reparo concluído)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.save_car_game(p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Tenta update primeiro
  UPDATE public.game_progress
  SET
    car_game_data = p_data,
    -- Espelha campos chave para o ranking/leaderboard
    money         = (p_data->>'money')::decimal,
    updated_at    = now()
  WHERE user_id = auth.uid();

  -- Se o jogador ainda não tem linha no game_progress, cria
  IF NOT FOUND THEN
    INSERT INTO public.game_progress (user_id, car_game_data, money)
    VALUES (
      auth.uid(),
      p_data,
      COALESCE((p_data->>'money')::decimal, 30000)
    );
  END IF;

  -- Atualiza total_patrimony no player_profiles para ranking
  UPDATE public.player_profiles
  SET
    total_patrimony = COALESCE((p_data->>'money')::decimal, 0),
    level = COALESCE((p_data->'reputation'->>'level')::integer, 1),
    updated_at = now()
  WHERE user_id = auth.uid();
END;
$$;

-- =====================================================================
-- 3) RPC: carregar progresso
-- Retorna o blob JSON salvo pelo jogador (ou null se nunca salvou)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.load_car_game()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data jsonb;
BEGIN
  SELECT car_game_data
    INTO v_data
    FROM public.game_progress
   WHERE user_id = auth.uid()
   LIMIT 1;

  RETURN v_data; -- null se não encontrado
END;
$$;

-- =====================================================================
-- 4) RPC: resetar progresso (botão de reset nas configurações)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.reset_car_game()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.game_progress
  SET car_game_data = NULL, money = 30000, updated_at = now()
  WHERE user_id = auth.uid();
END;
$$;

-- =====================================================================
-- 5) RLS: garante que apenas o próprio jogador acessa seus dados
-- (as policies já devem existir na tabela game_progress, mas garantimos
--  nas novas funções via SECURITY DEFINER + auth.uid())
-- =====================================================================

-- Permissões de execução (qualquer usuário autenticado pode chamar)
GRANT EXECUTE ON FUNCTION public.save_car_game(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.load_car_game()      TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_car_game()     TO authenticated;
