-- =====================================================================
-- PATCH_RACES_WON.sql — Adiciona coluna races_won ao player_profiles
-- e atualiza a view v_ranking para incluí-la.
-- Aplicar no Supabase → SQL Editor
-- =====================================================================

-- ── 1) Adiciona coluna races_won (idempotente) ────────────────────
ALTER TABLE public.player_profiles
  ADD COLUMN IF NOT EXISTS races_won integer NOT NULL DEFAULT 0;

-- ── 2) Atualiza save_car_game para persistir races_won ────────────
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

  -- Atualiza player_profiles para ranking
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

  -- Se não existia ainda, cria
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

-- ── 3) Recria view v_ranking incluindo races_won ──────────────────
-- DROP + CREATE necessário pois PostgreSQL não permite adicionar colunas via
-- CREATE OR REPLACE VIEW quando a view já existe com colunas diferentes.
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

-- Permissão para autenticados lerem a view
GRANT SELECT ON public.v_ranking TO authenticated;

-- ── 4) Verifica resultado ─────────────────────────────────────────
SELECT
  count(*)                                           AS total_jogadores,
  count(*) FILTER (WHERE total_patrimony > 0)        AS com_patrimonio,
  count(*) FILTER (WHERE races_won > 0)              AS com_rachas_vencidos
FROM public.player_profiles;
