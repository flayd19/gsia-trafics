-- Atualizar função para calcular patrimônio apenas com saldo na conta + mercadoria
CREATE OR REPLACE FUNCTION public.calculate_total_patrimony_complete(p_user_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    total_patrimony DECIMAL := 0;
    game_data RECORD;
    stock_value DECIMAL := 0;
    product_stock RECORD;
BEGIN
    -- Buscar dados do jogo
    SELECT * INTO game_data FROM public.game_progress WHERE user_id = p_user_id;
    
    IF FOUND THEN
        -- Somar dinheiro atual (saldo na conta)
        total_patrimony := total_patrimony + COALESCE(game_data.money, 0);
        
        -- Calcular valor do estoque baseado nos preços dos produtos (mercadoria)
        FOR product_stock IN 
            SELECT key as product_id, value::integer as quantity 
            FROM jsonb_each_text(game_data.stock) 
            WHERE (value)::integer > 0
        LOOP
            -- Preços baseados nos produtos do gameData.ts (preços de compra)
            stock_value := stock_value + (
                CASE product_stock.product_id
                    WHEN 'marlboro' THEN product_stock.quantity * 17
                    WHEN 'pods' THEN product_stock.quantity * 11
                    WHEN 'perfumes' THEN product_stock.quantity * 34
                    WHEN 'celulares' THEN product_stock.quantity * 1215
                    WHEN 'prensadao' THEN product_stock.quantity * 244
                    WHEN 'escama' THEN product_stock.quantity * 108
                    -- Produtos de armamentos atualizados
                    WHEN 'glock_g19' THEN product_stock.quantity * 3375  -- antigo 'armas'
                    WHEN '357_magnum' THEN product_stock.quantity * 3500
                    WHEN '762_parafal' THEN product_stock.quantity * 3800
                    WHEN '38_bulldog' THEN product_stock.quantity * 3200
                    -- Novo produto eletrônico
                    WHEN 'patinete_eletrico' THEN product_stock.quantity * 2800
                    -- Outros produtos existentes
                    WHEN 'smirnoffa' THEN product_stock.quantity * 25
                    WHEN 'camiseta_peruana' THEN product_stock.quantity * 21
                    WHEN 'tenis_mike' THEN product_stock.quantity * 81
                    WHEN 'ferramentas' THEN product_stock.quantity * 61
                    WHEN 'pneus' THEN product_stock.quantity * 95
                    WHEN 'pecas_carros' THEN product_stock.quantity * 122
                    WHEN 'bobigude' THEN product_stock.quantity * 21
                    WHEN 'starlinks' THEN product_stock.quantity * 630
                    WHEN 'nobesio_extra_forte' THEN product_stock.quantity * 473
                    WHEN 'tadalafila' THEN product_stock.quantity * 378
                    WHEN 'md_rosa' THEN product_stock.quantity * 567
                    WHEN 'bala' THEN product_stock.quantity * 432
                    WHEN 'ice_weed' THEN product_stock.quantity * 675
                    -- Manter produto 'armas' antigo para compatibilidade
                    WHEN 'armas' THEN product_stock.quantity * 3375
                    ELSE product_stock.quantity * 100 -- Fallback
                END
            );
        END LOOP;
        
        -- Somar apenas saldo + mercadoria (não incluir veículos e lojas)
        total_patrimony := total_patrimony + stock_value;
    END IF;
    
    RETURN COALESCE(total_patrimony, 0);
END;
$$;