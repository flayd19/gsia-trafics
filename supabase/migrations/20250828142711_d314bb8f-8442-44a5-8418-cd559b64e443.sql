-- Atualizar a função de atualização do ranking para usar o cálculo correto
CREATE OR REPLACE FUNCTION public.update_player_ranking_complete(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
    game_data RECORD;
    profile_data RECORD;
    patrimony DECIMAL;
    vehicle_count INTEGER;
    store_count INTEGER;
    owned_stores JSONB;
BEGIN
    -- Buscar dados do jogo
    SELECT * INTO game_data FROM public.game_progress WHERE user_id = p_user_id;
    SELECT * INTO profile_data FROM public.player_profiles WHERE user_id = p_user_id;
    
    IF FOUND THEN
        -- Calcular patrimônio completo usando a nova função
        patrimony := calculate_total_patrimony_complete(p_user_id);
        
        -- Contar veículos
        SELECT jsonb_array_length(COALESCE(game_data.vehicles, '[]'::jsonb)) INTO vehicle_count;
        
        -- Contar lojas se existirem
        SELECT 
            COUNT(*),
            jsonb_agg(store) FILTER (WHERE store->>'owned' = 'true')
        INTO store_count, owned_stores
        FROM jsonb_array_elements(COALESCE(game_data.stores, '[]'::jsonb)) AS store
        WHERE store->>'owned' = 'true';
        
        -- Atualizar ou inserir no ranking
        INSERT INTO public.player_ranking (
            user_id, display_name, total_patrimony, money, 
            total_vehicles, total_stores, game_day, stores_owned
        ) VALUES (
            p_user_id, 
            COALESCE(profile_data.display_name, 'Jogador'),
            patrimony,
            game_data.money,
            COALESCE(vehicle_count, 0),
            COALESCE(store_count, 0),
            game_data.game_day,
            COALESCE(owned_stores, '[]'::jsonb)
        )
        ON CONFLICT (user_id) DO UPDATE SET
            total_patrimony = EXCLUDED.total_patrimony,
            money = EXCLUDED.money,
            total_vehicles = EXCLUDED.total_vehicles,
            total_stores = EXCLUDED.total_stores,
            game_day = EXCLUDED.game_day,
            stores_owned = EXCLUDED.stores_owned,
            last_updated = NOW();
    END IF;
END;
$function$