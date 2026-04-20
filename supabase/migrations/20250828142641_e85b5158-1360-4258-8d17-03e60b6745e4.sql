-- Primeiro, criar a função de cálculo de patrimônio completo
CREATE OR REPLACE FUNCTION public.calculate_total_patrimony_complete(p_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
    total_patrimony DECIMAL := 0;
    game_data RECORD;
    stock_value DECIMAL := 0;
    vehicle_value DECIMAL := 0;
    vehicle JSONB;
    stock_item TEXT;
    stock_quantity INTEGER;
BEGIN
    -- Buscar dados do jogo
    SELECT * INTO game_data FROM public.game_progress WHERE user_id = p_user_id;
    
    IF FOUND THEN
        -- Somar dinheiro atual
        total_patrimony := total_patrimony + COALESCE(game_data.money, 0);
        
        -- Calcular valor do estoque baseado nos preços dos produtos
        FOR stock_item IN SELECT jsonb_object_keys(game_data.stock)
        LOOP
            stock_quantity := (game_data.stock->>stock_item)::INTEGER;
            
            -- Calcular valor baseado no tipo de produto (usando IDs dos produtos)
            CASE stock_item
                WHEN 'maconha' THEN stock_value := stock_value + (stock_quantity * 15); -- R$ 15 por grama
                WHEN 'cocaina' THEN stock_value := stock_value + (stock_quantity * 80); -- R$ 80 por grama  
                WHEN 'crack' THEN stock_value := stock_value + (stock_quantity * 25); -- R$ 25 por pedra
                WHEN 'ecstasy' THEN stock_value := stock_value + (stock_quantity * 35); -- R$ 35 por comprimido
                WHEN 'lsd' THEN stock_value := stock_value + (stock_quantity * 40); -- R$ 40 por papel
                WHEN 'heroina' THEN stock_value := stock_value + (stock_quantity * 120); -- R$ 120 por grama
                WHEN 'metanfetamina' THEN stock_value := stock_value + (stock_quantity * 100); -- R$ 100 por grama
                WHEN 'pistola' THEN stock_value := stock_value + (stock_quantity * 2500); -- R$ 2.500 por arma
                WHEN 'fuzil' THEN stock_value := stock_value + (stock_quantity * 8000); -- R$ 8.000 por arma
                WHEN 'granada' THEN stock_value := stock_value + (stock_quantity * 1500); -- R$ 1.500 por granada
                WHEN 'municao' THEN stock_value := stock_value + (stock_quantity * 5); -- R$ 5 por munição
                -- Produtos adicionais
                WHEN 'cigarro_comum' THEN stock_value := stock_value + (stock_quantity * 8);
                WHEN 'cigarro_premium' THEN stock_value := stock_value + (stock_quantity * 15);
                WHEN 'vape_descartavel' THEN stock_value := stock_value + (stock_quantity * 25);
                WHEN 'iphone_13' THEN stock_value := stock_value + (stock_quantity * 3500);
                WHEN 'samsung_s23' THEN stock_value := stock_value + (stock_quantity * 3000);
                WHEN 'camiseta_nike' THEN stock_value := stock_value + (stock_quantity * 150);
                WHEN 'tenis_jordan' THEN stock_value := stock_value + (stock_quantity * 800);
                WHEN 'whisky_johnnie' THEN stock_value := stock_value + (stock_quantity * 180);
                WHEN 'vodka_absolut' THEN stock_value := stock_value + (stock_quantity * 120);
                WHEN 'perfume_importado' THEN stock_value := stock_value + (stock_quantity * 300);
                WHEN 'kit_ferramentas' THEN stock_value := stock_value + (stock_quantity * 450);
                ELSE stock_value := stock_value + (stock_quantity * 10); -- Valor padrão para produtos desconhecidos
            END CASE;
        END LOOP;
        
        -- Calcular valor dos veículos
        FOR vehicle IN SELECT * FROM jsonb_array_elements(game_data.vehicles)
        LOOP
            -- Usar o preço do veículo se disponível, senão usar valores padrão baseados no nome
            IF vehicle ? 'price' AND vehicle->>'price' IS NOT NULL THEN
                vehicle_value := vehicle_value + (vehicle->>'price')::DECIMAL;
            ELSE
                -- Valores estimados baseados no nome do veículo
                CASE LOWER(vehicle->>'name')
                    WHEN 'monza 1997' THEN vehicle_value := vehicle_value + 25000;
                    WHEN 'uno mille' THEN vehicle_value := vehicle_value + 15000;
                    WHEN 'civic' THEN vehicle_value := vehicle_value + 45000;
                    WHEN 'corolla' THEN vehicle_value := vehicle_value + 85000;
                    WHEN 'hilux' THEN vehicle_value := vehicle_value + 180000;
                    WHEN 'amarok' THEN vehicle_value := vehicle_value + 150000;
                    WHEN 'scania' THEN vehicle_value := vehicle_value + 350000;
                    WHEN 'volvo fh' THEN vehicle_value := vehicle_value + 450000;
                    ELSE vehicle_value := vehicle_value + 50000; -- Valor padrão
                END CASE;
            END IF;
        END LOOP;
        
        total_patrimony := total_patrimony + stock_value + vehicle_value;
    END IF;
    
    RETURN COALESCE(total_patrimony, 0);
END;
$function$