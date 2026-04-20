-- Atualizar função para calcular patrimônio apenas com saldo e estoque (sem veículos)
-- Data: 30/01/2025
-- Descrição: Remove veículos do cálculo do ranking, considerando apenas saldo + estoque + lojas

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
    store_value DECIMAL := 0;
    product_stock RECORD;
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
                    WHEN 'glock_g19' THEN product_stock.quantity * 3375
                    WHEN '357_magnum' THEN product_stock.quantity * 2430
                    WHEN '762_parafal' THEN product_stock.quantity * 17270
                    WHEN '38_bulldog' THEN product_stock.quantity * 1688
                    WHEN 'smirnoffa' THEN product_stock.quantity * 25
                    WHEN 'camiseta_peruana' THEN product_stock.quantity * 21
                    WHEN 'tenis_mike' THEN product_stock.quantity * 81
                    WHEN 'ferramentas' THEN product_stock.quantity * 61
                    WHEN 'pneus' THEN product_stock.quantity * 95
                    WHEN 'pecas_carros' THEN product_stock.quantity * 122
                    WHEN 'bobigude' THEN product_stock.quantity * 21
                    WHEN 'starlinks' THEN product_stock.quantity * 630
                    WHEN 'caixa_municao' THEN product_stock.quantity * 1080
                    WHEN 'smart_watch' THEN product_stock.quantity * 473
                    WHEN 'notebook' THEN product_stock.quantity * 2970
                    WHEN 'tv_80_pl' THEN product_stock.quantity * 6075
                    ELSE product_stock.quantity * 100 -- Fallback
                END
            );
        END LOOP;
        
        -- REMOVIDO: Cálculo do valor dos veículos
        -- A classificação agora considera apenas saldo + estoque + lojas
        -- Veículos não são mais incluídos no cálculo do patrimônio para ranking
        
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
        
        -- Patrimônio total = saldo + estoque + lojas (SEM veículos)
        total_patrimony := total_patrimony + stock_value + store_value;
    END IF;
    
    RETURN COALESCE(total_patrimony, 0);
END;
$function$;

-- Comentário explicativo sobre a mudança
COMMENT ON FUNCTION public.calculate_total_patrimony_complete(uuid) IS 'Calcula patrimônio total baseado apenas em saldo + estoque + lojas. Veículos foram removidos do cálculo do ranking conforme solicitação do usuário.';

-- Atualizar comentário da tabela de ranking
COMMENT ON TABLE public.player_ranking IS 'Ranking público dos jogadores baseado no patrimônio (saldo + estoque + lojas, sem veículos)';

-- Atualizar todos os rankings existentes com a nova lógica
-- Isso irá recalcular o patrimônio de todos os jogadores sem incluir veículos
DO $$
DECLARE
    user_record RECORD;
BEGIN
    FOR user_record IN 
        SELECT DISTINCT user_id FROM public.game_progress
    LOOP
        PERFORM public.update_player_ranking_complete(user_record.user_id);
    END LOOP;
END $$;