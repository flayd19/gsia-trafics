-- =====================================================================
-- GSIA TRAFICS — SETUP COMPLETO DO BACKEND
-- =====================================================================
-- Este arquivo é IDEMPOTENTE: pode ser executado em um projeto novo ou
-- em um projeto que já tem parte da estrutura. Nada é duplicado, nada
-- é apagado. Se der erro numa instrução, o resto continua rodando.
--
-- Como usar:
--   1. Abra https://supabase.com/dashboard
--   2. Selecione o projeto do GSIA TRAFICS
--   3. Menu lateral → SQL Editor → New query
--   4. Cole o conteúdo INTEIRO deste arquivo e clique em Run
--   5. Aguarde "Success" no fim. Pronto — backend configurado.
--
-- O que este script configura:
--   • Tabelas: player_profiles, game_progress, game_backups,
--             player_ranking, activity_logs, player_market_listings
--   • RLS (Row Level Security) em todas as tabelas com policies corretas
--   • Trigger que cria profile+progress AUTOMATICAMENTE no cadastro
--   • RPCs para salvar progresso, criar backups, comprar/cancelar
--     ofertas no Mercado P2P, etc.
--   • Backfill: contas antigas ganham profile+progress que faltam.
-- =====================================================================

-- =====================================================================
-- 1) TABELAS
-- =====================================================================

create table if not exists public.player_profiles (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade unique,
    display_name text not null,
    total_patrimony decimal default 0,
    total_assets_value decimal default 0,
    level integer default 1,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists public.game_progress (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade unique,
    money decimal not null default 40000,
    overdraft_limit decimal default -30000,
    last_interest_calculation integer default 1,
    game_day integer default 1,
    game_hour integer default 6,
    game_minute integer default 0,
    last_game_update bigint default 0,
    warehouse_level integer default 1,
    warehouse_capacity integer default 1440,
    current_warehouse text default 'rua36',
    last_weekly_cost_paid integer default 1,
    lawyer_hired boolean default false,
    tow_truck_hired boolean default false,
    completed_orders integer default 0,
    completed_sales_in_cycle integer default 0,
    last_buyer_generation integer default 1,
    last_price_update bigint default 0,
    vehicles jsonb default '[]'::jsonb,
    drivers jsonb default '[]'::jsonb,
    stock jsonb default '{}'::jsonb,
    buyers jsonb default '[]'::jsonb,
    current_trips jsonb default '[]'::jsonb,
    pending_deliveries jsonb default '[]'::jsonb,
    police_interceptions jsonb default '[]'::jsonb,
    vehicle_sales jsonb default '[]'::jsonb,
    product_sales jsonb default '[]'::jsonb,
    stores jsonb default '[]'::jsonb,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    last_backup timestamptz default now()
);

-- Colunas de timer de compradores (adicionadas em migration posterior)
alter table public.game_progress
    add column if not exists is_waiting_for_new_buyers boolean default false,
    add column if not exists new_buyers_timer_start bigint default 0,
    add column if not exists new_buyers_timer_duration integer default 30;

create table if not exists public.game_backups (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade,
    backup_data jsonb not null,
    backup_type text default 'auto',
    game_day integer,
    total_money decimal,
    created_at timestamptz default now()
);

create table if not exists public.player_ranking (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade unique,
    display_name text not null,
    total_patrimony decimal not null default 0,
    money decimal default 0,
    total_vehicles integer default 0,
    total_stores integer default 0,
    game_day integer default 1,
    level integer default 1,
    stores_owned jsonb default '[]'::jsonb,
    last_updated timestamptz default now(),
    created_at timestamptz default now()
);

create table if not exists public.activity_logs (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users(id) on delete cascade,
    action_type text not null,
    action_data jsonb,
    session_id text,
    ip_address inet,
    created_at timestamptz default now()
);

-- Mercado P2P
create table if not exists public.player_market_listings (
    id uuid primary key default gen_random_uuid(),
    seller_id uuid not null references auth.users(id) on delete cascade,
    seller_name text not null,
    product_id text not null,
    product_name text not null,
    product_icon text,
    category text,
    quantity integer not null check (quantity > 0),
    price_per_unit numeric(14, 2) not null check (price_per_unit > 0),
    total_price numeric(14, 2) generated always as (quantity * price_per_unit) stored,
    status text not null default 'active' check (status in ('active', 'sold', 'cancelled', 'expired')),
    buyer_id uuid references auth.users(id) on delete set null,
    buyer_name text,
    sold_at timestamptz,
    paid_out_at timestamptz,
    created_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '7 days')
);

-- =====================================================================
-- 2) ÍNDICES
-- =====================================================================

create index if not exists idx_game_progress_user_id on public.game_progress(user_id);
create index if not exists idx_game_backups_user_id on public.game_backups(user_id);
create index if not exists idx_player_ranking_patrimony on public.player_ranking(total_patrimony desc);
create index if not exists idx_activity_logs_user_id on public.activity_logs(user_id);
create index if not exists idx_activity_logs_created_at on public.activity_logs(created_at desc);
create index if not exists idx_market_listings_status_created on public.player_market_listings (status, created_at desc);
create index if not exists idx_market_listings_seller on public.player_market_listings (seller_id, status);
create index if not exists idx_market_listings_buyer on public.player_market_listings (buyer_id, status) where buyer_id is not null;
create index if not exists idx_market_listings_category on public.player_market_listings (category, status);

-- =====================================================================
-- 3) ROW LEVEL SECURITY
-- =====================================================================

alter table public.player_profiles enable row level security;
alter table public.game_progress enable row level security;
alter table public.game_backups enable row level security;
alter table public.player_ranking enable row level security;
alter table public.activity_logs enable row level security;
alter table public.player_market_listings enable row level security;

-- player_profiles
drop policy if exists "pp_select_own" on public.player_profiles;
create policy "pp_select_own" on public.player_profiles
    for select using (auth.uid() = user_id);

drop policy if exists "pp_insert_own" on public.player_profiles;
create policy "pp_insert_own" on public.player_profiles
    for insert with check (auth.uid() = user_id);

drop policy if exists "pp_update_own" on public.player_profiles;
create policy "pp_update_own" on public.player_profiles
    for update using (auth.uid() = user_id);

-- game_progress
drop policy if exists "gp_all_own" on public.game_progress;
create policy "gp_all_own" on public.game_progress
    for all using (auth.uid() = user_id);

-- game_backups
drop policy if exists "gb_all_own" on public.game_backups;
create policy "gb_all_own" on public.game_backups
    for all using (auth.uid() = user_id);

-- player_ranking (leitura pública, escrita restrita)
drop policy if exists "pr_select_all" on public.player_ranking;
create policy "pr_select_all" on public.player_ranking
    for select using (true);

drop policy if exists "pr_insert_own" on public.player_ranking;
create policy "pr_insert_own" on public.player_ranking
    for insert with check (auth.uid() = user_id);

drop policy if exists "pr_update_own" on public.player_ranking;
create policy "pr_update_own" on public.player_ranking
    for update using (auth.uid() = user_id);

-- activity_logs
drop policy if exists "al_select_own" on public.activity_logs;
create policy "al_select_own" on public.activity_logs
    for select using (auth.uid() = user_id);

drop policy if exists "al_insert_own" on public.activity_logs;
create policy "al_insert_own" on public.activity_logs
    for insert with check (auth.uid() = user_id);

-- player_market_listings
drop policy if exists "pml_read_active_or_own" on public.player_market_listings;
create policy "pml_read_active_or_own" on public.player_market_listings
    for select to authenticated
    using (status = 'active' or seller_id = auth.uid() or buyer_id = auth.uid());

drop policy if exists "pml_insert_own" on public.player_market_listings;
create policy "pml_insert_own" on public.player_market_listings
    for insert to authenticated
    with check (seller_id = auth.uid() and status = 'active');

drop policy if exists "pml_update_own_seller" on public.player_market_listings;
create policy "pml_update_own_seller" on public.player_market_listings
    for update to authenticated
    using (seller_id = auth.uid())
    with check (seller_id = auth.uid());

-- =====================================================================
-- 4) FUNÇÕES HELPER
-- =====================================================================

-- updated_at auto
create or replace function public.update_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

-- Patrimônio total
create or replace function public.calculate_total_patrimony(p_user_id uuid)
returns decimal language plpgsql security definer as $$
declare
    total_patrimony decimal := 0;
    game_data record;
begin
    select * into game_data from public.game_progress where user_id = p_user_id;
    if found then
        total_patrimony := total_patrimony + coalesce(game_data.money, 0);
        select total_patrimony + coalesce(sum((vehicle->>'price')::decimal), 0)
            into total_patrimony
            from jsonb_array_elements(game_data.vehicles) as vehicle
            where vehicle->>'price' is not null;
        select total_patrimony + coalesce(sum((store->>'purchasePrice')::decimal), 0)
            into total_patrimony
            from jsonb_array_elements(game_data.stores) as store
            where store->>'owned' = 'true' and store->>'purchasePrice' is not null;
    end if;
    return coalesce(total_patrimony, 0);
end;
$$;

-- Atualizar ranking
create or replace function public.update_player_ranking(p_user_id uuid)
returns void language plpgsql security definer as $$
declare
    game_data record;
    profile_data record;
    patrimony decimal;
    vehicle_count integer;
    store_count integer;
    owned_stores jsonb;
begin
    select * into game_data from public.game_progress where user_id = p_user_id;
    select * into profile_data from public.player_profiles where user_id = p_user_id;
    if found then
        patrimony := calculate_total_patrimony(p_user_id);
        select jsonb_array_length(game_data.vehicles) into vehicle_count;
        select count(*), jsonb_agg(store) filter (where store->>'owned' = 'true')
            into store_count, owned_stores
            from jsonb_array_elements(game_data.stores) as store
            where store->>'owned' = 'true';
        insert into public.player_ranking (
            user_id, display_name, total_patrimony, money,
            total_vehicles, total_stores, game_day, stores_owned
        ) values (
            p_user_id,
            coalesce(profile_data.display_name, 'Jogador'),
            patrimony,
            game_data.money,
            coalesce(vehicle_count, 0),
            coalesce(store_count, 0),
            game_data.game_day,
            coalesce(owned_stores, '[]'::jsonb)
        )
        on conflict (user_id) do update set
            total_patrimony = excluded.total_patrimony,
            money = excluded.money,
            total_vehicles = excluded.total_vehicles,
            total_stores = excluded.total_stores,
            game_day = excluded.game_day,
            stores_owned = excluded.stores_owned,
            last_updated = now();
    end if;
end;
$$;

-- Criar backup
create or replace function public.create_game_backup(p_user_id uuid, p_backup_type text default 'auto')
returns uuid language plpgsql security definer as $$
declare
    backup_id uuid;
    game_data record;
begin
    select * into game_data from public.game_progress where user_id = p_user_id;
    if found then
        insert into public.game_backups (user_id, backup_data, backup_type, game_day, total_money)
        values (p_user_id, row_to_json(game_data)::jsonb, p_backup_type, game_data.game_day, game_data.money)
        returning id into backup_id;
        -- Mantém só os 10 mais recentes
        delete from public.game_backups
            where user_id = p_user_id
            and id not in (
                select id from public.game_backups
                where user_id = p_user_id
                order by created_at desc
                limit 10
            );
    end if;
    return backup_id;
end;
$$;

-- =====================================================================
-- 5) UPSERT DO PROGRESSO (chamado pelo cliente)
-- =====================================================================

-- Remove versões antigas com assinaturas diferentes
drop function if exists upsert_game_progress_safe(
    uuid, decimal, decimal, integer, integer, integer, integer, bigint,
    integer, integer, text, integer, boolean, boolean, integer, integer,
    integer, bigint, text, text, text, text, text, text, text, text, text, text
);
drop function if exists upsert_game_progress_safe(
    uuid, decimal, decimal, integer, integer, integer, integer, bigint,
    integer, integer, text, integer, boolean, boolean, integer, integer,
    integer, bigint, boolean, bigint, integer, text, text, text, text, text, text, text, text, text, text
);

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
    p_stores jsonb
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
        vehicle_sales, product_sales, stores
    ) values (
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
        updated_at = now();
    return true;
end;
$$;

grant execute on function upsert_game_progress_safe(
    uuid, decimal, decimal, integer, integer, integer, integer, bigint,
    integer, integer, text, integer, boolean, boolean, integer, integer,
    integer, bigint, boolean, bigint, integer, jsonb, jsonb, jsonb, jsonb,
    jsonb, jsonb, jsonb, jsonb, jsonb, jsonb
) to authenticated;

-- =====================================================================
-- 6) TRIGGERS
-- =====================================================================

-- updated_at
drop trigger if exists update_player_profiles_updated_at on public.player_profiles;
create trigger update_player_profiles_updated_at
    before update on public.player_profiles
    for each row execute function public.update_updated_at();

drop trigger if exists update_game_progress_updated_at on public.game_progress;
create trigger update_game_progress_updated_at
    before update on public.game_progress
    for each row execute function public.update_updated_at();

-- Backup e ranking automáticos
create or replace function public.auto_backup_and_ranking()
returns trigger language plpgsql as $$
begin
    perform public.create_game_backup(new.user_id, 'auto');
    perform public.update_player_ranking(new.user_id);
    return new;
end;
$$;

drop trigger if exists auto_backup_and_ranking_trigger on public.game_progress;
create trigger auto_backup_and_ranking_trigger
    after insert or update on public.game_progress
    for each row execute function public.auto_backup_and_ranking();

-- =====================================================================
-- 7) TRIGGER DO CADASTRO (cria profile + progress automaticamente)
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
    v_display_name text;
begin
    v_display_name := coalesce(
        nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
        nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
        split_part(coalesce(new.email, ''), '@', 1),
        'Jogador'
    );
    insert into public.player_profiles (user_id, display_name)
        values (new.id, v_display_name)
        on conflict (user_id) do nothing;
    insert into public.game_progress (user_id, money)
        values (new.id, 40000)
        on conflict (user_id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

-- RPC defensiva (cliente pode chamar pra garantir que os registros existam)
create or replace function public.ensure_user_bootstrap(p_display_name text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
    v_uid uuid := auth.uid();
    v_email text;
    v_name text;
begin
    if v_uid is null then
        raise exception 'not authenticated';
    end if;
    select email into v_email from auth.users where id = v_uid;
    v_name := coalesce(
        nullif(trim(p_display_name), ''),
        split_part(coalesce(v_email, ''), '@', 1),
        'Jogador'
    );
    insert into public.player_profiles (user_id, display_name)
        values (v_uid, v_name)
        on conflict (user_id) do nothing;
    insert into public.game_progress (user_id, money)
        values (v_uid, 40000)
        on conflict (user_id) do nothing;
end;
$$;

grant execute on function public.ensure_user_bootstrap(text) to authenticated;

-- =====================================================================
-- 8) RPCs DO MERCADO P2P
-- =====================================================================

create or replace function public.purchase_market_listing(p_listing_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
    v_buyer_id uuid := auth.uid();
    v_buyer_name text;
    v_listing public.player_market_listings%rowtype;
begin
    if v_buyer_id is null then
        return json_build_object('success', false, 'message', 'Usuário não autenticado');
    end if;
    select display_name into v_buyer_name from public.player_profiles where user_id = v_buyer_id limit 1;
    if v_buyer_name is null then v_buyer_name := 'Jogador'; end if;
    select * into v_listing from public.player_market_listings where id = p_listing_id for update;
    if not found then
        return json_build_object('success', false, 'message', 'Oferta não encontrada');
    end if;
    if v_listing.status <> 'active' then
        return json_build_object('success', false, 'message', 'Oferta não está mais ativa');
    end if;
    if v_listing.seller_id = v_buyer_id then
        return json_build_object('success', false, 'message', 'Você não pode comprar sua própria oferta');
    end if;
    if v_listing.expires_at < now() then
        update public.player_market_listings set status = 'expired' where id = p_listing_id;
        return json_build_object('success', false, 'message', 'Oferta expirou');
    end if;
    update public.player_market_listings
        set status = 'sold', buyer_id = v_buyer_id, buyer_name = v_buyer_name, sold_at = now()
        where id = p_listing_id returning * into v_listing;
    return json_build_object('success', true, 'message', 'Compra realizada com sucesso', 'listing', row_to_json(v_listing));
end;
$$;
grant execute on function public.purchase_market_listing(uuid) to authenticated;

create or replace function public.collect_market_payouts()
returns json language plpgsql security definer set search_path = public as $$
declare
    v_seller_id uuid := auth.uid();
    v_total numeric := 0;
    v_count int := 0;
    v_listings json;
begin
    if v_seller_id is null then
        return json_build_object('success', false, 'message', 'Usuário não autenticado', 'total', 0, 'count', 0);
    end if;
    with updated as (
        update public.player_market_listings
        set paid_out_at = now()
        where seller_id = v_seller_id and status = 'sold' and paid_out_at is null
        returning *
    )
    select coalesce(sum(total_price), 0)::numeric, count(*)::int, coalesce(json_agg(row_to_json(updated)), '[]'::json)
        into v_total, v_count, v_listings from updated;
    return json_build_object('success', true, 'total', v_total, 'count', v_count, 'listings', v_listings);
end;
$$;
grant execute on function public.collect_market_payouts() to authenticated;

create or replace function public.cancel_market_listing(p_listing_id uuid)
returns json language plpgsql security definer set search_path = public as $$
declare
    v_seller_id uuid := auth.uid();
    v_listing public.player_market_listings%rowtype;
begin
    if v_seller_id is null then
        return json_build_object('success', false, 'message', 'Usuário não autenticado');
    end if;
    select * into v_listing from public.player_market_listings where id = p_listing_id for update;
    if not found then
        return json_build_object('success', false, 'message', 'Oferta não encontrada');
    end if;
    if v_listing.seller_id <> v_seller_id then
        return json_build_object('success', false, 'message', 'Você não é o vendedor desta oferta');
    end if;
    if v_listing.status <> 'active' then
        return json_build_object('success', false, 'message', 'Oferta não está ativa');
    end if;
    update public.player_market_listings set status = 'cancelled' where id = p_listing_id returning * into v_listing;
    return json_build_object('success', true, 'listing', row_to_json(v_listing));
end;
$$;
grant execute on function public.cancel_market_listing(uuid) to authenticated;

create or replace function public.expire_old_market_listings()
returns int language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
    update public.player_market_listings set status = 'expired'
        where status = 'active' and expires_at < now();
    get diagnostics v_count = row_count;
    return v_count;
end;
$$;
grant execute on function public.expire_old_market_listings() to authenticated;

-- =====================================================================
-- 9) BACKFILL — cria profile/progress pra contas antigas que não tenham
-- =====================================================================

insert into public.player_profiles (user_id, display_name)
select u.id,
       coalesce(
           nullif(trim(u.raw_user_meta_data->>'display_name'), ''),
           split_part(coalesce(u.email, ''), '@', 1),
           'Jogador'
       )
from auth.users u
left join public.player_profiles p on p.user_id = u.id
where p.user_id is null
on conflict (user_id) do nothing;

insert into public.game_progress (user_id)
select u.id
from auth.users u
left join public.game_progress g on g.user_id = u.id
where g.user_id is null
on conflict (user_id) do nothing;

-- =====================================================================
-- 10) VIEW DO RANKING PÚBLICO
-- =====================================================================

create or replace view public.top_players as
    select display_name, total_patrimony, total_vehicles, total_stores,
           game_day, stores_owned, last_updated
    from public.player_ranking
    order by total_patrimony desc
    limit 100;

-- =====================================================================
-- FIM. Se viu "Success. No rows returned" ou similar, deu tudo certo.
-- =====================================================================

select
    'Backend GSIA TRAFICS configurado com sucesso!' as status,
    (select count(*) from public.player_profiles) as profiles_existentes,
    (select count(*) from public.game_progress) as progresso_salvo,
    (select count(*) from auth.users) as contas_auth;
