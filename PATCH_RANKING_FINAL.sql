-- =====================================================================
-- PATCH_RANKING_FINAL.sql — Corrige ranking para mostrar todos os jogadores
-- Problema: RLS SELECT em player_profiles bloqueava leitura de outros perfis
-- Aplicar no Supabase → SQL Editor
-- =====================================================================

-- ── 1) CORRIGE A POLÍTICA RLS (causa raiz do problema) ────────────
-- Remove a política restrita que só permite ver o próprio perfil
DROP POLICY IF EXISTS "Users can view their own profile" ON public.player_profiles;

-- Cria nova política: qualquer autenticado pode LER todos os perfis (para ranking)
-- Mas só pode INSERIR/ATUALIZAR o próprio
CREATE POLICY "Authenticated users can view all profiles"
  ON public.player_profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- ── 2) GARANTE COLUNA display_name (idempotente) ──────────────────
ALTER TABLE public.player_profiles
  ADD COLUMN IF NOT EXISTS display_name text;

-- ── 3) GARANTE COLUNAS total_patrimony e level com defaults ───────
ALTER TABLE public.player_profiles
  ALTER COLUMN total_patrimony SET DEFAULT 0;

ALTER TABLE public.player_profiles
  ALTER COLUMN level SET DEFAULT 1;

-- ── 4) BACKFILL display_name para quem está NULL/vazio ────────────
UPDATE public.player_profiles pp
SET display_name = COALESCE(
  NULLIF(trim(pp.display_name), ''),
  split_part(coalesce(u.email, ''), '@', 1),
  'Jogador'
)
FROM auth.users u
WHERE pp.user_id = u.id
  AND (pp.display_name IS NULL OR trim(pp.display_name) = '');

-- ── 5) BACKFILL total_patrimony de quem tem 0/NULL mas tem save ───
-- Usa o money do game_progress como aproximação mínima
UPDATE public.player_profiles pp
SET
  total_patrimony = GREATEST(
    COALESCE(pp.total_patrimony, 0),
    COALESCE(gp.money, 0),
    -- Se tem car_game_data, pega o money de lá
    COALESCE((gp.car_game_data->>'money')::decimal, 0)
  )
FROM public.game_progress gp
WHERE pp.user_id = gp.user_id
  AND COALESCE(pp.total_patrimony, 0) = 0
  AND gp.car_game_data IS NOT NULL;

-- ── 6) BACKFILL level de quem tem NULL/1 mas tem save ─────────────
UPDATE public.player_profiles pp
SET level = GREATEST(
  COALESCE(pp.level, 1),
  COALESCE((gp.car_game_data->'reputation'->>'level')::integer, 1)
)
FROM public.game_progress gp
WHERE pp.user_id = gp.user_id
  AND gp.car_game_data IS NOT NULL
  AND (gp.car_game_data->'reputation'->>'level')::integer > COALESCE(pp.level, 1);

-- ── 7) Habilita Realtime na tabela player_profiles ────────────────
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

-- ── 8) View v_ranking (sem JOIN em auth.users — só player_profiles) ─
-- Não usa auth.users para evitar restrição de acesso em queries de client
CREATE OR REPLACE VIEW public.v_ranking AS
SELECT
  pp.user_id,
  COALESCE(NULLIF(trim(pp.display_name), ''), 'Jogador') AS display_name,
  COALESCE(pp.total_patrimony, 0)  AS total_patrimony,
  COALESCE(pp.level, 1)           AS level,
  pp.updated_at
FROM public.player_profiles pp
ORDER BY pp.total_patrimony DESC NULLS LAST;

-- Permissão para autenticados lerem a view
GRANT SELECT ON public.v_ranking TO authenticated;

-- ── 9) Recria save_car_game garantindo total_patrimony + display_name
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
  -- total_patrimony = money + valor_carros (calculado no cliente e enviado no JSON)
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
    updated_at = now()
  WHERE user_id = auth.uid();

  -- Se não existia ainda, cria
  INSERT INTO public.player_profiles (user_id, display_name, total_patrimony, level)
  SELECT
    auth.uid(),
    COALESCE(NULLIF(trim(p_data->>'display_name'), ''), 'Jogador'),
    COALESCE(NULLIF((p_data->>'total_patrimony')::decimal, 0), (p_data->>'money')::decimal, 0),
    COALESCE((p_data->'reputation'->>'level')::integer, 1)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.player_profiles WHERE user_id = auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_car_game(jsonb) TO authenticated;

-- ── 10) Verifica resultado ─────────────────────────────────────────
SELECT
  count(*) AS total_jogadores,
  count(*) FILTER (WHERE total_patrimony > 0) AS com_patrimonio,
  count(*) FILTER (WHERE display_name IS NOT NULL) AS com_nome
FROM public.player_profiles;
