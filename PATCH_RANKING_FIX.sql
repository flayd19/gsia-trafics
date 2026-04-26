-- =====================================================================
-- PATCH: Ranking — corrige total_patrimony + display_name
-- Aplicar no Supabase → SQL Editor
-- =====================================================================

-- 1) Garante coluna display_name existe no player_profiles
ALTER TABLE public.player_profiles
  ADD COLUMN IF NOT EXISTS display_name text;

-- 2) Backfill: preenche display_name dos jogadores que ainda não têm,
--    usando o email deles em auth.users
UPDATE public.player_profiles pp
SET display_name = split_part(coalesce(u.email, ''), '@', 1)
FROM auth.users u
WHERE pp.user_id = u.id
  AND (pp.display_name IS NULL OR trim(pp.display_name) = '');

-- 3) Recria save_car_game para salvar total_patrimony real
--    (money + valor dos carros) e display_name
CREATE OR REPLACE FUNCTION public.save_car_game(p_data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Atualiza progresso principal
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

  -- Atualiza perfil para ranking
  -- total_patrimony vem como campo separado no JSON (money + valor dos carros)
  -- display_name também vem no payload para manter atualizado
  UPDATE public.player_profiles
  SET
    total_patrimony = COALESCE(
      NULLIF((p_data->>'total_patrimony')::decimal, 0),
      (p_data->>'money')::decimal,
      total_patrimony  -- mantém o atual se o campo não vier
    ),
    display_name = COALESCE(
      NULLIF(trim(p_data->>'display_name'), ''),
      display_name
    ),
    level       = COALESCE((p_data->'reputation'->>'level')::integer, level, 1),
    updated_at  = now()
  WHERE user_id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_car_game(jsonb) TO authenticated;

-- 4) Recria load_car_game (sem alteração funcional — mantém compatibilidade)
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

  RETURN v_data;
END;
$$;

GRANT EXECUTE ON FUNCTION public.load_car_game() TO authenticated;

-- 5) Garante que a coluna total_patrimony existe com default correto
ALTER TABLE public.player_profiles
  ALTER COLUMN total_patrimony SET DEFAULT 0;

-- 6) View auxiliar para o ranking (usada pelo RankingScreen via SELECT direto)
-- Ordena por total_patrimony desc, expõe apenas as colunas necessárias
CREATE OR REPLACE VIEW public.v_ranking AS
SELECT
  pp.user_id,
  COALESCE(NULLIF(trim(pp.display_name), ''), split_part(u.email, '@', 1), 'Jogador') AS display_name,
  COALESCE(pp.total_patrimony, 0)  AS total_patrimony,
  COALESCE(pp.level, 1)            AS level,
  pp.updated_at
FROM public.player_profiles pp
JOIN auth.users u ON u.id = pp.user_id
ORDER BY pp.total_patrimony DESC NULLS LAST;

-- Permite que usuários autenticados leiam a view
GRANT SELECT ON public.v_ranking TO authenticated;
