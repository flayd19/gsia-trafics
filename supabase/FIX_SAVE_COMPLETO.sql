-- ============================================================
-- FIX: Salvamento completo (reputação, pickups, stats de produtos)
-- ============================================================
-- Problemas resolvidos:
--   1. reputation (nível + XP) não era salvo → jogador volta no Nv 1
--   2. pendingPickups (fila de fornecedores) não era salvo → viagens somem
--   3. productStats (preço médio/último por produto) não era salvo
--   4. buyers era salvo mas nunca carregado de volta
--
-- Como usar: cole TUDO no SQL Editor do Supabase e rode. Idempotente
-- (pode rodar várias vezes sem quebrar).
-- ============================================================

-- 1) Novas colunas
alter table public.game_progress
    add column if not exists reputation jsonb default '{"level": 1, "xp": 0, "totalXp": 0}'::jsonb,
    add column if not exists pending_pickups jsonb default '[]'::jsonb,
    add column if not exists product_stats jsonb default '{}'::jsonb,
    add column if not exists motorcycles jsonb default '[]'::jsonb;

-- 2) Remover TODAS as versões anteriores do upsert (evita conflito de sobrecarga)
do $$
declare
    r record;
begin
    for r in
        select oid::regprocedure::text as signature
        from pg_proc
        where proname = 'upsert_game_progress_safe'
          and pronamespace = 'public'::regnamespace
    loop
        execute 'drop function if exists ' || r.signature;
    end loop;
end $$;

-- 3) Nova versão do upsert com os campos faltantes
create or replace function upsert_game_progress_safe(
    p_user_id uuid,
    p_money decimal,
    p_overdraft_limit decimal,
    p_last_interest_calculation integer,
    p_game_day integer,
    p_game_hour integer,
    p_game_minute integer,
    p_last_game_update bigint,
    p_warehouse_level integer,
    p_warehouse_capacity integer,
    p_current_warehouse text,
    p_last_weekly_cost_paid integer,
    p_lawyer_hired boolean,
    p_tow_truck_hired boolean,
    p_completed_orders integer,
    p_completed_sales_in_cycle integer,
    p_last_buyer_generation integer,
    p_last_price_update bigint,
    p_is_waiting_for_new_buyers boolean,
    p_new_buyers_timer_start bigint,
    p_new_buyers_timer_duration integer,
    p_vehicles jsonb,
    p_drivers jsonb,
    p_stock jsonb,
    p_buyers jsonb,
    p_current_trips jsonb,
    p_pending_deliveries jsonb,
    p_police_interceptions jsonb,
    p_vehicle_sales jsonb,
    p_product_sales jsonb,
    p_stores jsonb,
    p_reputation jsonb default null,
    p_pending_pickups jsonb default null,
    p_product_stats jsonb default null,
    p_motorcycles jsonb default null
) returns boolean language plpgsql security definer set search_path = public as $$
begin
    insert into public.game_progress (
        user_id, money, overdraft_limit, last_interest_calculation,
        game_day, game_hour, game_minute, last_game_update,
        warehouse_level, warehouse_capacity, current_warehouse,
        last_weekly_cost_paid, lawyer_hired, tow_truck_hired,
        completed_orders, completed_sales_in_cycle, last_buyer_generation,
        last_price_update, is_waiting_for_new_buyers, new_buyers_timer_start,
        new_buyers_timer_duration, vehicles, drivers, stock, buyers,
        current_trips, pending_deliveries, police_interceptions,
        vehicle_sales, product_sales, stores,
        reputation, pending_pickups, product_stats, motorcycles
    ) values (
        p_user_id, p_money, p_overdraft_limit, p_last_interest_calculation,
        p_game_day, p_game_hour, p_game_minute, p_last_game_update,
        p_warehouse_level, p_warehouse_capacity, p_current_warehouse,
        p_last_weekly_cost_paid, p_lawyer_hired, p_tow_truck_hired,
        p_completed_orders, p_completed_sales_in_cycle, p_last_buyer_generation,
        p_last_price_update, p_is_waiting_for_new_buyers, p_new_buyers_timer_start,
        p_new_buyers_timer_duration, p_vehicles, p_drivers, p_stock, p_buyers,
        p_current_trips, p_pending_deliveries, p_police_interceptions,
        p_vehicle_sales, p_product_sales, p_stores,
        coalesce(p_reputation, '{"level": 1, "xp": 0, "totalXp": 0}'::jsonb),
        coalesce(p_pending_pickups, '[]'::jsonb),
        coalesce(p_product_stats, '{}'::jsonb),
        coalesce(p_motorcycles, '[]'::jsonb)
    )
    on conflict (user_id) do update set
        money = excluded.money,
        overdraft_limit = excluded.overdraft_limit,
        last_interest_calculation = excluded.last_interest_calculation,
        game_day = excluded.game_day,
        game_hour = excluded.game_hour,
        game_minute = excluded.game_minute,
        last_game_update = excluded.last_game_update,
        warehouse_level = excluded.warehouse_level,
        warehouse_capacity = excluded.warehouse_capacity,
        current_warehouse = excluded.current_warehouse,
        last_weekly_cost_paid = excluded.last_weekly_cost_paid,
        lawyer_hired = excluded.lawyer_hired,
        tow_truck_hired = excluded.tow_truck_hired,
        completed_orders = excluded.completed_orders,
        completed_sales_in_cycle = excluded.completed_sales_in_cycle,
        last_buyer_generation = excluded.last_buyer_generation,
        last_price_update = excluded.last_price_update,
        is_waiting_for_new_buyers = excluded.is_waiting_for_new_buyers,
        new_buyers_timer_start = excluded.new_buyers_timer_start,
        new_buyers_timer_duration = excluded.new_buyers_timer_duration,
        vehicles = excluded.vehicles,
        drivers = excluded.drivers,
        stock = excluded.stock,
        buyers = excluded.buyers,
        current_trips = excluded.current_trips,
        pending_deliveries = excluded.pending_deliveries,
        police_interceptions = excluded.police_interceptions,
        vehicle_sales = excluded.vehicle_sales,
        product_sales = excluded.product_sales,
        stores = excluded.stores,
        reputation = coalesce(excluded.reputation, game_progress.reputation),
        pending_pickups = coalesce(excluded.pending_pickups, game_progress.pending_pickups),
        product_stats = coalesce(excluded.product_stats, game_progress.product_stats),
        motorcycles = coalesce(excluded.motorcycles, game_progress.motorcycles),
        updated_at = now();
    return true;
end;
$$;

grant execute on function upsert_game_progress_safe(
    uuid, decimal, decimal, integer, integer, integer, integer, bigint,
    integer, integer, text, integer, boolean, boolean, integer, integer,
    integer, bigint, boolean, bigint, integer, jsonb, jsonb, jsonb, jsonb,
    jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) to authenticated;

-- 4) Verificação
select
    column_name,
    data_type,
    column_default
from information_schema.columns
where table_schema = 'public'
  and table_name = 'game_progress'
  and column_name in ('reputation', 'pending_pickups', 'product_stats', 'motorcycles')
order by column_name;
