-- Criar função para upsert seguro do game progress
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
  p_vehicles TEXT,
  p_drivers TEXT,
  p_stock TEXT,
  p_buyers TEXT,
  p_current_trips TEXT,
  p_pending_deliveries TEXT,
  p_police_interceptions TEXT,
  p_vehicle_sales TEXT,
  p_product_sales TEXT,
  p_stores TEXT
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
        last_price_update, vehicles, drivers, stock, buyers,
        current_trips, pending_deliveries, police_interceptions,
        vehicle_sales, product_sales, stores
    ) VALUES (
        p_user_id, p_money, p_overdraft_limit, p_last_interest_calculation,
        p_game_day, p_game_hour, p_game_minute, p_last_game_update,
        p_warehouse_level, p_warehouse_capacity, p_current_warehouse,
        p_last_weekly_cost_paid, p_lawyer_hired, p_tow_truck_hired,
        p_completed_orders, p_completed_sales_in_cycle, p_last_buyer_generation,
        p_last_price_update, 
        p_vehicles::jsonb, p_drivers::jsonb, p_stock::jsonb, p_buyers::jsonb,
        p_current_trips::jsonb, p_pending_deliveries::jsonb, p_police_interceptions::jsonb,
        p_vehicle_sales::jsonb, p_product_sales::jsonb, p_stores::jsonb
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