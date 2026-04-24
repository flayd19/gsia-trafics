-- =====================================================================
-- GSIA CARROS — Sistema de Save
-- =====================================================================
-- Como usar:
--   1. Acesse https://supabase.com/dashboard
--   2. Selecione o projeto do GSIA
--   3. Menu lateral → SQL Editor → New query
--   4. Cole TODO o conteúdo deste arquivo e clique em Run
--   5. Deve aparecer "Success" — pronto, o save está funcionando!
--
-- Este script é SEGURO e IDEMPOTENTE:
--   • Não apaga dados existentes
--   • Pode ser executado mais de uma vez sem problemas
--   • Só adiciona o que ainda não existe
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────
-- 1. COLUNA DE SAVE
--    Adiciona car_game_data à tabela game_progress já existente.
--    Se a coluna já existir, não faz nada.
-- ─────────────────────────────────────────────────────────────────
ALTER TABLE public.game_progress
  ADD COLUMN IF NOT EXISTS car_game_data jsonb DEFAULT NULL;


-- ─────────────────────────────────────────────────────────────────
-- 2. FUNÇÃO: save_car_game
--    Chamada pelo jogo automaticamente a cada 30s e nos eventos
--    importantes (compra, venda, reparo, desbloqueio de vaga).
--    Salva o estado completo do jogo e atualiza o ranking.
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.save_car_game(p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_money    decimal;
  v_level    integer;
BEGIN
  -- Extrai campos do JSON para espelhar no ranking
  v_money := COALESCE((p_data->>'money')::decimal,  30000);
  v_level := COALESCE((p_data->'reputation'->>'level')::integer, 1);

  -- Tenta atualizar o save existente
  UPDATE public.game_progress
  SET
    car_game_data = p_data,
    money         = v_money,
    updated_at    = now()
  WHERE user_id = auth.uid();

  -- Se não tinha registro (primeiro save), cria um
  IF NOT FOUND THEN
    INSERT INTO public.game_progress (user_id, car_game_data, money)
    VALUES (auth.uid(), p_data, v_money)
    ON CONFLICT (user_id) DO UPDATE
      SET car_game_data = EXCLUDED.car_game_data,
          money         = EXCLUDED.money,
          updated_at    = now();
  END IF;

  -- Espelha saldo e nível no perfil do jogador (para ranking)
  UPDATE public.player_profiles
  SET
    total_patrimony = v_money,
    level           = v_level,
    updated_at      = now()
  WHERE user_id = auth.uid();

END;
$$;


-- ─────────────────────────────────────────────────────────────────
-- 3. FUNÇÃO: load_car_game
--    Chamada ao abrir o jogo. Retorna o save do jogador logado.
--    Retorna NULL se o jogador nunca salvou (começa do zero).
-- ─────────────────────────────────────────────────────────────────
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

  RETURN v_data;  -- null = primeiro acesso, inicia save novo
END;
$$;


-- ─────────────────────────────────────────────────────────────────
-- 4. FUNÇÃO: reset_car_game
--    Chamada pelo botão "Resetar jogo" nas Configurações.
--    Apaga o save e volta para R$ 30.000 iniciais.
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reset_car_game()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.game_progress
  SET
    car_game_data = NULL,
    money         = 30000,
    updated_at    = now()
  WHERE user_id = auth.uid();
END;
$$;


-- ─────────────────────────────────────────────────────────────────
-- 5. PERMISSÕES
--    Qualquer usuário autenticado pode chamar essas funções,
--    mas cada um só acessa os próprios dados (via auth.uid()).
-- ─────────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.save_car_game(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.load_car_game()      TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_car_game()     TO authenticated;


-- ─────────────────────────────────────────────────────────────────
-- 6. VERIFICAÇÃO FINAL (opcional — só para confirmar que funcionou)
-- ─────────────────────────────────────────────────────────────────
DO $$
DECLARE
  col_exists  boolean;
  fn_save     boolean;
  fn_load     boolean;
  fn_reset    boolean;
BEGIN
  -- Checa a coluna
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'game_progress'
       AND column_name  = 'car_game_data'
  ) INTO col_exists;

  -- Checa as funções
  SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'save_car_game')  INTO fn_save;
  SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'load_car_game')  INTO fn_load;
  SELECT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'reset_car_game') INTO fn_reset;

  RAISE NOTICE '=====================================';
  RAISE NOTICE 'GSIA Carros — Verificação do Save';
  RAISE NOTICE '=====================================';
  RAISE NOTICE 'Coluna car_game_data : %', CASE WHEN col_exists THEN '✓ OK' ELSE '✗ FALTANDO' END;
  RAISE NOTICE 'Função save_car_game : %', CASE WHEN fn_save   THEN '✓ OK' ELSE '✗ FALTANDO' END;
  RAISE NOTICE 'Função load_car_game : %', CASE WHEN fn_load   THEN '✓ OK' ELSE '✗ FALTANDO' END;
  RAISE NOTICE 'Função reset_car_game: %', CASE WHEN fn_reset  THEN '✓ OK' ELSE '✗ FALTANDO' END;
  RAISE NOTICE '=====================================';

  IF col_exists AND fn_save AND fn_load AND fn_reset THEN
    RAISE NOTICE 'TUDO CERTO! O save do jogo está configurado.';
  ELSE
    RAISE WARNING 'Algo não foi criado corretamente. Verifique os erros acima.';
  END IF;
END;
$$;
