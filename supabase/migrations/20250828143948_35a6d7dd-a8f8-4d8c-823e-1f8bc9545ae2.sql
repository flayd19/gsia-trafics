-- Atualizar função para calcular patrimônio com lógica correta
CREATE OR REPLACE FUNCTION public.calculate_total_patrimony_complete(p_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    total_patrimony DECIMAL := 0;
    game_data RECORD;
    stock_value DECIMAL := 0;
    vehicle_value DECIMAL := 0;
    store_value DECIMAL := 0;
    product_stock RECORD;
    vehicle RECORD;
    store RECORD;
BEGIN
    -- Buscar dados do jogo
    SELECT * INTO game_data FROM public.game_progress WHERE user_id = p_user_id;
    
    IF FOUND THEN
        -- Somar dinheiro atual
        total_patrimony := total_patrimony + COALESCE(game_data.money, 0);
        
        -- Calcular valor do estoque baseado nos preços dos produtos
        -- Usando preços fictícios baseados nos produtos do jogo
        FOR product_stock IN 
            SELECT key as product_id, value::integer as quantity 
            FROM jsonb_each_text(game_data.stock) 
            WHERE (value)::integer > 0
        LOOP
            -- Preços baseados nos produtos do gameData.ts
            stock_value := stock_value + (
                CASE product_stock.product_id
                    WHEN 'marlboro' THEN product_stock.quantity * 17
                    WHEN 'pods' THEN product_stock.quantity * 11
                    WHEN 'perfumes' THEN product_stock.quantity * 34
                    WHEN 'celulares' THEN product_stock.quantity * 1215
                    WHEN 'prensadao' THEN product_stock.quantity * 244
                    WHEN 'escama' THEN product_stock.quantity * 108
                    WHEN 'armas' THEN product_stock.quantity * 3375
                    WHEN 'smirnoffa' THEN product_stock.quantity * 25
                    WHEN 'camiseta_peruana' THEN product_stock.quantity * 21
                    WHEN 'tenis_mike' THEN product_stock.quantity * 81
                    WHEN 'ferramentas' THEN product_stock.quantity * 61
                    WHEN 'pneus' THEN product_stock.quantity * 95
                    WHEN 'pecas_carros' THEN product_stock.quantity * 122
                    WHEN 'bobigude' THEN product_stock.quantity * 21
                    WHEN 'starlinks' THEN product_stock.quantity * 630
                    ELSE product_stock.quantity * 100 -- Fallback
                END
            );
        END LOOP;
        
        -- Calcular valor dos veículos baseado nos preços do marketplace
        FOR vehicle IN 
            SELECT jsonb_extract_path_text(value, 'price')::numeric as price,
                   jsonb_extract_path_text(value, 'name') as name
            FROM jsonb_array_elements(COALESCE(game_data.vehicles, '[]'::jsonb))
        LOOP
            IF vehicle.price IS NOT NULL AND vehicle.price > 0 THEN
                vehicle_value := vehicle_value + vehicle.price;
            ELSE
                -- Preços baseados no marketplace do gameData.ts
                vehicle_value := vehicle_value + (
                    CASE 
                        WHEN vehicle.name ILIKE '%monza%' THEN 15000
                        WHEN vehicle.name ILIKE '%uno%' THEN 8000
                        WHEN vehicle.name ILIKE '%kombi%' THEN 22000
                        WHEN vehicle.name ILIKE '%courier%' THEN 28000
                        WHEN vehicle.name ILIKE '%van%' THEN 45000
                        WHEN vehicle.name ILIKE '%escort%' THEN 110000
                        WHEN vehicle.name ILIKE '%fiat 500%' THEN 45000
                        WHEN vehicle.name ILIKE '%jetta%' THEN 60000
                        WHEN vehicle.name ILIKE '%bmw%' THEN 100000
                        WHEN vehicle.name ILIKE '%amarok%' THEN 70000
                        WHEN vehicle.name ILIKE '%bell 206%' THEN 1800000
                        WHEN vehicle.name ILIKE '%fh540%' THEN 1200000
                        WHEN vehicle.name ILIKE '%scania%' THEN 700000
                        ELSE 25000 -- Fallback
                    END
                );
            END IF;
        END LOOP;
        
        -- Calcular valor das lojas compradas
        FOR store IN 
            SELECT jsonb_extract_path_text(value, 'owned')::boolean as owned,
                   jsonb_extract_path_text(value, 'purchasePrice')::numeric as purchase_price
            FROM jsonb_array_elements(COALESCE(game_data.stores, '[]'::jsonb))
        LOOP
            IF store.owned = true AND store.purchase_price IS NOT NULL THEN
                store_value := store_value + store.purchase_price;
            END IF;
        END LOOP;
        
        total_patrimony := total_patrimony + stock_value + vehicle_value + store_value;
    END IF;
    
    RETURN COALESCE(total_patrimony, 0);
END;
$function$;