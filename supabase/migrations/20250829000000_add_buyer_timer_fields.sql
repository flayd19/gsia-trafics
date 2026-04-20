-- Adicionar campos para timer de geração de compradores
ALTER TABLE public.game_progress 
ADD COLUMN IF NOT EXISTS is_waiting_for_new_buyers BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS new_buyers_timer_start BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS new_buyers_timer_duration INTEGER DEFAULT 30;

-- Remover todas as versões existentes da função para evitar conflito de sobrecarga
-- Versão original com parâmetros TEXT (da migração 20250828135439)
DROP FUNCTION IF EXISTS upsert_game_progress_safe(
  UUID, DECIMAL, DECIMAL, INTEGER, INTEGER, INTEGER, INTEGER, BIGINT,
  INTEGER, INTEGER, TEXT, INTEGER, BOOLEAN, BOOLEAN, INTEGER, INTEGER,
  INTEGER, BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
);

-- Versão com campos de timer e parâmetros TEXT
DROP FUNCTION IF EXISTS upsert_game_progress_safe(
  UUID, DECIMAL, DECIMAL, INTEGER, INTEGER, INTEGER, INTEGER, BIGINT,
  INTEGER, INTEGER, TEXT, INTEGER, BOOLEAN, BOOLEAN, INTEGER, INTEGER,
  INTEGER, BIGINT, BOOLEAN, BIGINT, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT
);

-- Versão com tipos JSONB
DROP FUNCTION IF EXISTS upsert_game_progress_safe(
  UUID, DECIMAL, DECIMAL, INTEGER, INTEGER, INTEGER, INTEGER, BIGINT,
  INTEGER, INTEGER, TEXT, INTEGER, BOOLEAN, BOOLEAN, INTEGER, INTEGER,
  INTEGER, BIGINT, BOOLEAN, BIGINT, INTEGER, JSONB, JSONB, JSONB, JSONB,
  JSONB, JSONB, JSONB, JSONB, JSONB, JSONB
);

-- Atualizar função upsert para incluir os novos campos
CREATE OR REPLACE FUNCTION upsert_game_progress_safe(
  p_user_id UUID,
  p_money DECIMAL,
  p_overdraft_limit DECIMAL,
  p_last_interest_calculation INTEGER,
  p_game_day INTEGER,
  p_game_hour INTEGER,
  p_game_minute INTEGER,
  p_last_game_update BIGINT,
  p_warehouse_level INTEGER,
  p_warehouse_capacity INTEGER,
  p_current_warehouse TEXT,
  p_last_weekly_cost_paid INTEGER,
  p_lawyer_hired BOOLEAN,
  p_tow_truck_hired BOOLEAN,
  p_completed_orders INTEGER,
  p_completed_sales_in_cycle INTEGER,
  p_last_buyer_generation INTEGER,
  p_last_price_update BIGINT,
  p_is_waiting_for_new_buyers BOOLEAN,
  p_new_buyers_timer_start BIGINT,
  p_new_buyers_timer_duration INTEGER,
  p_vehicles JSONB,
  p_drivers JSONB,
  p_stock JSONB,
  p_buyers JSONB,
  p_current_trips JSONB,
  p_pending_deliveries JSONB,
  p_police_interceptions JSONB,
  p_vehicle_sales JSONB,
  p_product_sales JSONB,
  p_stores JSONB
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.game_progress (
        user_id, money, overdraft_limit, last_interest_calculation,
        game_day, game_hour, game_minute, last_game_update,
        warehouse_level, warehouse_capacity, current_warehouse,
        last_weekly_cost_paid, lawyer_hired, tow_truck_hired,
        completed_orders, completed_sales_in_cycle, last_buyer_generation,
        last_price_update, is_waiting_for_new_buyers, new_buyers_timer_start,
        new_buyers_timer_duration, vehicles, drivers, stock, buyers,
        current_trips, pending_deliveries, police_interceptions,
        vehicle_sales, product_sales, stores
    ) VALUES (
        p_user_id, p_money, p_overdraft_limit, p_last_interest_calculation,
        p_game_day, p_game_hour, p_game_minute, p_last_game_update,
        p_warehouse_level, p_warehouse_capacity, p_current_warehouse,
        p_last_weekly_cost_paid, p_lawyer_hired, p_tow_truck_hired,
        p_completed_orders, p_completed_sales_in_cycle, p_last_buyer_generation,
        p_last_price_update, p_is_waiting_for_new_buyers, p_new_buyers_timer_start,
        p_new_buyers_timer_duration, p_vehicles, p_drivers, p_stock, p_buyers,
        p_current_trips, p_pending_deliveries, p_police_interceptions,
        p_vehicle_sales, p_product_sales, p_stores
    )
    ON CONFLICT (user_id) DO UPDATE SET
        money = EXCLUDED.money,
        overdraft_limit = EXCLUDED.overdraft_limit,
        last_interest_calculation = EXCLUDED.last_interest_calculation,
        game_day = EXCLUDED.game_day,
        game_hour = EXCLUDED.game_hour,
        game_minute = EXCLUDED.game_minute,
        last_game_update = EXCLUDED.last_game_update,
        warehouse_level = EXCLUDED.warehouse_level,
        warehouse_capacity = EXCLUDED.warehouse_capacity,
        current_warehouse = EXCLUDED.current_warehouse,
        last_weekly_cost_paid = EXCLUDED.last_weekly_cost_paid,
        lawyer_hired = EXCLUDED.lawyer_hired,
        tow_truck_hired = EXCLUDED.tow_truck_hired,
        completed_orders = EXCLUDED.completed_orders,
        completed_sales_in_cycle = EXCLUDED.completed_sales_in_cycle,
        last_buyer_generation = EXCLUDED.last_buyer_generation,
        last_price_update = EXCLUDED.last_price_update,
        is_waiting_for_new_buyers = EXCLUDED.is_waiting_for_new_buyers,
        new_buyers_timer_start = EXCLUDED.new_buyers_timer_start,
        new_buyers_timer_duration = EXCLUDED.new_buyers_timer_duration,
        vehicles = EXCLUDED.vehicles,
        drivers = EXCLUDED.drivers,
        stock = EXCLUDED.stock,
        buyers = EXCLUDED.buyers,
        current_trips = EXCLUDED.current_trips,
        pending_deliveries = EXCLUDED.pending_deliveries,
        police_interceptions = EXCLUDED.police_interceptions,
        vehicle_sales = EXCLUDED.vehicle_sales,
        product_sales = EXCLUDED.product_sales,
        stores = EXCLUDED.stores,
        updated_at = NOW();

    RETURN TRUE;
END;
$$;