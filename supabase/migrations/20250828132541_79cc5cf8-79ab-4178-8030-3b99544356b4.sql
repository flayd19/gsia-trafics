-- =====================================================
-- REORGANIZAÇÃO COMPLETA DO BANCO SUPABASE PARA TRAFIC GAME
-- Sistema completo de progresso, ranking e segurança
-- =====================================================

-- 1. TABELA DE PERFIS DOS JOGADORES
CREATE TABLE IF NOT EXISTS public.player_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    display_name TEXT NOT NULL,
    total_patrimony DECIMAL DEFAULT 0,
    total_assets_value DECIMAL DEFAULT 0,
    level INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TABELA PRINCIPAL DE PROGRESSO DO JOGO (OTIMIZADA)
CREATE TABLE IF NOT EXISTS public.game_progress (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    
    -- Dados financeiros
    money DECIMAL NOT NULL DEFAULT 15000,
    overdraft_limit DECIMAL DEFAULT -30000,
    last_interest_calculation INTEGER DEFAULT 1,
    
    -- Tempo de jogo
    game_day INTEGER DEFAULT 1,
    game_hour INTEGER DEFAULT 6,
    game_minute INTEGER DEFAULT 0,
    last_game_update BIGINT DEFAULT 0,
    
    -- Warehouse
    warehouse_level INTEGER DEFAULT 1,
    warehouse_capacity INTEGER DEFAULT 1440,
    current_warehouse TEXT DEFAULT 'rua36',
    last_weekly_cost_paid INTEGER DEFAULT 1,
    
    -- Contratos e serviços
    lawyer_hired BOOLEAN DEFAULT FALSE,
    tow_truck_hired BOOLEAN DEFAULT FALSE,
    
    -- Estatísticas de jogo
    completed_orders INTEGER DEFAULT 0,
    completed_sales_in_cycle INTEGER DEFAULT 0,
    last_buyer_generation INTEGER DEFAULT 1,
    last_price_update BIGINT DEFAULT 0,
    
    -- Dados estruturais (JSONB para flexibilidade)
    vehicles JSONB DEFAULT '[]'::jsonb,
    drivers JSONB DEFAULT '[{"id": "felipe", "name": "Felipe Mendes", "dailyWage": 257, "repairDiscount": 0, "breakdownChanceModifier": 0.1, "seizureChanceModifier": 0.1, "speedModifier": 0.05, "experience": "iniciante", "assigned": true, "photo": "/lovable-uploads/4476bcca-8aeb-4119-befe-efb3257ff415.png", "description": "Ex-marceneiro, tem 4 filhos com 4 mulheres diferentes. Busca uma renda extra.", "vehicles": ["Monza", "Uno"], "trait": "Confiável mas inexperiente"}]'::jsonb,
    stock JSONB DEFAULT '{}'::jsonb,
    buyers JSONB DEFAULT '[]'::jsonb,
    current_trips JSONB DEFAULT '[]'::jsonb,
    pending_deliveries JSONB DEFAULT '[]'::jsonb,
    police_interceptions JSONB DEFAULT '[]'::jsonb,
    vehicle_sales JSONB DEFAULT '[]'::jsonb,
    product_sales JSONB DEFAULT '[]'::jsonb,
    stores JSONB DEFAULT '[]'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_backup TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. TABELA DE BACKUP AUTOMÁTICO
CREATE TABLE IF NOT EXISTS public.game_backups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    backup_data JSONB NOT NULL,
    backup_type TEXT DEFAULT 'auto', -- 'auto', 'manual', 'crash'
    game_day INTEGER,
    total_money DECIMAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. TABELA DE RANKING DOS JOGADORES
CREATE TABLE IF NOT EXISTS public.player_ranking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    display_name TEXT NOT NULL,
    total_patrimony DECIMAL NOT NULL DEFAULT 0,
    money DECIMAL DEFAULT 0,
    total_vehicles INTEGER DEFAULT 0,
    total_stores INTEGER DEFAULT 0,
    game_day INTEGER DEFAULT 1,
    level INTEGER DEFAULT 1,
    stores_owned JSONB DEFAULT '[]'::jsonb,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. TABELA DE LOGS DE ATIVIDADE
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action_type TEXT NOT NULL, -- 'login', 'save', 'purchase', 'sale', 'crash'
    action_data JSONB,
    session_id TEXT,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- HABILITAR RLS (ROW LEVEL SECURITY)
-- =====================================================

ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_ranking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- POLÍTICAS RLS
-- =====================================================

-- Player Profiles
CREATE POLICY "Users can view their own profile" ON public.player_profiles
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.player_profiles
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.player_profiles
FOR UPDATE USING (auth.uid() = user_id);

-- Game Progress
CREATE POLICY "Users can access their own game progress" ON public.game_progress
FOR ALL USING (auth.uid() = user_id);

-- Game Backups
CREATE POLICY "Users can access their own backups" ON public.game_backups
FOR ALL USING (auth.uid() = user_id);

-- Player Ranking (público para visualização, privado para edição)
CREATE POLICY "Everyone can view ranking" ON public.player_ranking
FOR SELECT USING (true);

CREATE POLICY "Users can update their own ranking" ON public.player_ranking
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ranking entry" ON public.player_ranking
FOR UPDATE USING (auth.uid() = user_id);

-- Activity Logs
CREATE POLICY "Users can view their own logs" ON public.activity_logs
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own logs" ON public.activity_logs
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- =====================================================
-- FUNÇÕES ÚTEIS
-- =====================================================

-- Função para calcular patrimônio total
CREATE OR REPLACE FUNCTION public.calculate_total_patrimony(p_user_id UUID)
RETURNS DECIMAL AS $$
DECLARE
    total_patrimony DECIMAL := 0;
    game_data RECORD;
BEGIN
    SELECT * INTO game_data FROM public.game_progress WHERE user_id = p_user_id;
    
    IF FOUND THEN
        -- Somar dinheiro
        total_patrimony := total_patrimony + COALESCE(game_data.money, 0);
        
        -- Somar valor dos veículos
        SELECT total_patrimony + COALESCE(SUM((vehicle->>'price')::DECIMAL), 0)
        INTO total_patrimony
        FROM jsonb_array_elements(game_data.vehicles) AS vehicle
        WHERE vehicle->>'price' IS NOT NULL;
        
        -- Somar valor do estoque (baseado no custo base dos produtos)
        -- Aqui seria necessário ter uma tabela de produtos ou usar valores fixos
        
        -- Somar valor das lojas
        SELECT total_patrimony + COALESCE(SUM((store->>'purchasePrice')::DECIMAL), 0)
        INTO total_patrimony
        FROM jsonb_array_elements(game_data.stores) AS store
        WHERE store->>'owned' = 'true' AND store->>'purchasePrice' IS NOT NULL;
    END IF;
    
    RETURN COALESCE(total_patrimony, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para atualizar ranking
CREATE OR REPLACE FUNCTION public.update_player_ranking(p_user_id UUID)
RETURNS VOID AS $$
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
        -- Calcular patrimônio
        patrimony := calculate_total_patrimony(p_user_id);
        
        -- Contar veículos
        SELECT jsonb_array_length(game_data.vehicles) INTO vehicle_count;
        
        -- Contar lojas e extrair lojas possuídas
        SELECT 
            COUNT(*),
            jsonb_agg(store) FILTER (WHERE store->>'owned' = 'true')
        INTO store_count, owned_stores
        FROM jsonb_array_elements(game_data.stores) AS store
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para criar backup automático
CREATE OR REPLACE FUNCTION public.create_game_backup(p_user_id UUID, p_backup_type TEXT DEFAULT 'auto')
RETURNS UUID AS $$
DECLARE
    backup_id UUID;
    game_data RECORD;
BEGIN
    SELECT * INTO game_data FROM public.game_progress WHERE user_id = p_user_id;
    
    IF FOUND THEN
        INSERT INTO public.game_backups (user_id, backup_data, backup_type, game_day, total_money)
        VALUES (
            p_user_id,
            row_to_json(game_data)::jsonb,
            p_backup_type,
            game_data.game_day,
            game_data.money
        )
        RETURNING id INTO backup_id;
        
        -- Manter apenas os últimos 10 backups por usuário
        DELETE FROM public.game_backups 
        WHERE user_id = p_user_id 
        AND id NOT IN (
            SELECT id FROM public.game_backups 
            WHERE user_id = p_user_id 
            ORDER BY created_at DESC 
            LIMIT 10
        );
    END IF;
    
    RETURN backup_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS AUTOMÁTICOS
-- =====================================================

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar triggers
CREATE TRIGGER update_player_profiles_updated_at BEFORE UPDATE ON public.player_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_game_progress_updated_at BEFORE UPDATE ON public.game_progress FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Trigger para backup automático e atualização de ranking
CREATE OR REPLACE FUNCTION public.auto_backup_and_ranking()
RETURNS TRIGGER AS $$
BEGIN
    -- Criar backup a cada atualização importante
    PERFORM public.create_game_backup(NEW.user_id, 'auto');
    
    -- Atualizar ranking
    PERFORM public.update_player_ranking(NEW.user_id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_backup_and_ranking_trigger 
AFTER INSERT OR UPDATE ON public.game_progress 
FOR EACH ROW EXECUTE FUNCTION public.auto_backup_and_ranking();

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_game_progress_user_id ON public.game_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_game_backups_user_id ON public.game_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_player_ranking_patrimony ON public.player_ranking(total_patrimony DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON public.activity_logs(created_at DESC);

-- =====================================================
-- MIGRAÇÃO DOS DADOS EXISTENTES
-- =====================================================

-- Migrar dados da tabela simple_game_progress se existir
DO $$
DECLARE
    old_record RECORD;
    game_data JSONB;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'simple_game_progress') THEN
        FOR old_record IN SELECT * FROM simple_game_progress LOOP
            game_data := old_record.game_data;
            
            INSERT INTO public.game_progress (
                user_id, money, overdraft_limit, last_interest_calculation,
                game_day, game_hour, game_minute, last_game_update,
                warehouse_level, warehouse_capacity, current_warehouse,
                last_weekly_cost_paid, lawyer_hired, tow_truck_hired,
                completed_orders, completed_sales_in_cycle, last_buyer_generation,
                last_price_update, vehicles, drivers, stock, buyers,
                current_trips, pending_deliveries, police_interceptions,
                vehicle_sales, product_sales, stores, created_at, updated_at
            ) VALUES (
                old_record.user_id,
                COALESCE((game_data->>'money')::DECIMAL, 15000),
                COALESCE((game_data->>'overdraft_limit')::DECIMAL, -30000),
                COALESCE((game_data->>'last_interest_calculation')::INTEGER, 1),
                COALESCE((game_data->'gameTime'->>'day')::INTEGER, 1),
                COALESCE((game_data->'gameTime'->>'hour')::INTEGER, 6),
                COALESCE((game_data->'gameTime'->>'minute')::INTEGER, 0),
                COALESCE((game_data->'gameTime'->>'lastUpdate')::BIGINT, 0),
                COALESCE((game_data->>'warehouse_level')::INTEGER, 1),
                COALESCE((game_data->>'warehouse_capacity')::INTEGER, 1440),
                COALESCE(game_data->>'current_warehouse', 'rua36'),
                COALESCE((game_data->>'last_weekly_cost_paid')::INTEGER, 1),
                COALESCE((game_data->>'lawyer_hired')::BOOLEAN, FALSE),
                COALESCE((game_data->>'tow_truck_hired')::BOOLEAN, FALSE),
                COALESCE((game_data->>'completed_orders')::INTEGER, 0),
                COALESCE((game_data->>'completed_sales_in_cycle')::INTEGER, 0),
                COALESCE((game_data->>'last_buyer_generation')::INTEGER, 1),
                COALESCE((game_data->>'last_price_update')::BIGINT, 0),
                COALESCE(game_data->'vehicles', '[{"id": "monza1", "name": "Monza 1997", "capacity": 200, "fuelCost": 300, "price": 15000, "assigned": true, "driverId": "felipe", "active": false, "tripDuration": 22.5, "breakdownChance": 0.05}]'::jsonb),
                COALESCE(game_data->'drivers', '[{"id": "felipe", "name": "Felipe Mendes", "dailyWage": 257, "repairDiscount": 0, "breakdownChanceModifier": 0.1, "seizureChanceModifier": 0.1, "speedModifier": 0.05, "experience": "iniciante", "assigned": true, "photo": "/lovable-uploads/4476bcca-8aeb-4119-befe-efb3257ff415.png", "description": "Ex-marceneiro, tem 4 filhos com 4 mulheres diferentes. Busca uma renda extra.", "vehicles": ["Monza", "Uno"], "trait": "Confiável mas inexperiente"}]'::jsonb),
                COALESCE(game_data->'stock', '{}'::jsonb),
                COALESCE(game_data->'buyers', '[]'::jsonb),
                COALESCE(game_data->'current_trips', '[]'::jsonb),
                COALESCE(game_data->'pending_deliveries', '[]'::jsonb),
                COALESCE(game_data->'police_interceptions', '[]'::jsonb),
                COALESCE(game_data->'vehicle_sales', '[]'::jsonb),
                COALESCE(game_data->'product_sales', '[]'::jsonb),
                COALESCE(game_data->'stores', '[]'::jsonb),
                old_record.created_at,
                old_record.updated_at
            ) ON CONFLICT (user_id) DO NOTHING;
        END LOOP;
    END IF;
END $$;

-- =====================================================
-- VIEWS ÚTEIS
-- =====================================================

-- View do ranking público
CREATE OR REPLACE VIEW public.top_players AS
SELECT 
    display_name,
    total_patrimony,
    total_vehicles,
    total_stores,
    game_day,
    stores_owned,
    last_updated
FROM public.player_ranking
ORDER BY total_patrimony DESC
LIMIT 100;

-- =====================================================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- =====================================================

COMMENT ON TABLE public.player_profiles IS 'Perfis dos jogadores com informações básicas';
COMMENT ON TABLE public.game_progress IS 'Progresso completo do jogo de cada jogador';
COMMENT ON TABLE public.game_backups IS 'Backups automáticos para recuperação de dados';
COMMENT ON TABLE public.player_ranking IS 'Ranking público dos jogadores baseado no patrimônio';
COMMENT ON TABLE public.activity_logs IS 'Logs de atividade para auditoria e debugging';

-- Sucesso!
SELECT 'Database reorganizado com sucesso!' as status,
       'Tabelas: player_profiles, game_progress, game_backups, player_ranking, activity_logs' as tabelas_criadas,
       'RLS habilitado com políticas de segurança' as seguranca,
       'Triggers automáticos para backup e ranking' as automacao,
       'Funções úteis para cálculo de patrimônio' as funcionalidades;