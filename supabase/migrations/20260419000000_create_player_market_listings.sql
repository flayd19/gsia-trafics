-- =====================================================================
-- Migration: Mercado P2P entre jogadores
-- Data: 2026-04-19
-- =====================================================================
-- Cria a tabela player_market_listings para ofertas de produtos entre
-- jogadores, com RLS para leitura pública autenticada e escrita restrita
-- ao dono da oferta. A compra é feita via RPC atômica para evitar
-- condições de corrida (duplo-gasto da mesma oferta).
-- =====================================================================

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
    paid_out_at timestamptz, -- quando o vendedor coletou o dinheiro
    created_at timestamptz not null default now(),
    expires_at timestamptz not null default (now() + interval '7 days')
);

-- Índices para performance em queries típicas
create index if not exists idx_player_market_listings_status_created
    on public.player_market_listings (status, created_at desc);
create index if not exists idx_player_market_listings_seller
    on public.player_market_listings (seller_id, status);
create index if not exists idx_player_market_listings_buyer
    on public.player_market_listings (buyer_id, status)
    where buyer_id is not null;
create index if not exists idx_player_market_listings_category
    on public.player_market_listings (category, status);

-- Habilitar RLS
alter table public.player_market_listings enable row level security;

-- Policies: qualquer usuário autenticado pode ler ofertas ativas e suas próprias
drop policy if exists "read_active_or_own" on public.player_market_listings;
create policy "read_active_or_own"
    on public.player_market_listings
    for select
    to authenticated
    using (status = 'active' or seller_id = auth.uid() or buyer_id = auth.uid());

-- Policy de INSERT: usuário só pode criar oferta em seu próprio nome
drop policy if exists "insert_own" on public.player_market_listings;
create policy "insert_own"
    on public.player_market_listings
    for insert
    to authenticated
    with check (seller_id = auth.uid() and status = 'active');

-- Policy de UPDATE: vendedor pode cancelar sua própria oferta ativa e marcar paid_out
drop policy if exists "update_own_seller" on public.player_market_listings;
create policy "update_own_seller"
    on public.player_market_listings
    for update
    to authenticated
    using (seller_id = auth.uid())
    with check (seller_id = auth.uid());

-- Função RPC: compra atômica de uma oferta
-- Retorna JSON com {success, message, listing}
create or replace function public.purchase_market_listing(p_listing_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
    v_buyer_id uuid := auth.uid();
    v_buyer_name text;
    v_listing public.player_market_listings%rowtype;
begin
    if v_buyer_id is null then
        return json_build_object('success', false, 'message', 'Usuário não autenticado');
    end if;

    -- Buscar nome do comprador no perfil
    select display_name into v_buyer_name
    from public.player_profiles
    where user_id = v_buyer_id
    limit 1;

    if v_buyer_name is null then
        v_buyer_name := 'Jogador';
    end if;

    -- Lock da linha específica para evitar race condition
    select * into v_listing
    from public.player_market_listings
    where id = p_listing_id
    for update;

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
        update public.player_market_listings
        set status = 'expired'
        where id = p_listing_id;
        return json_build_object('success', false, 'message', 'Oferta expirou');
    end if;

    -- Efetivar compra
    update public.player_market_listings
    set status = 'sold',
        buyer_id = v_buyer_id,
        buyer_name = v_buyer_name,
        sold_at = now()
    where id = p_listing_id
    returning * into v_listing;

    return json_build_object(
        'success', true,
        'message', 'Compra realizada com sucesso',
        'listing', row_to_json(v_listing)
    );
end;
$$;

grant execute on function public.purchase_market_listing(uuid) to authenticated;

-- Função RPC: coletar pagamentos pendentes (ofertas vendidas sem paid_out_at)
-- Retorna as listings que foram marcadas como pagas e o total
create or replace function public.collect_market_payouts()
returns json
language plpgsql
security definer
set search_path = public
as $$
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
        where seller_id = v_seller_id
          and status = 'sold'
          and paid_out_at is null
        returning *
    )
    select coalesce(sum(total_price), 0)::numeric,
           count(*)::int,
           coalesce(json_agg(row_to_json(updated)), '[]'::json)
    into v_total, v_count, v_listings
    from updated;

    return json_build_object(
        'success', true,
        'total', v_total,
        'count', v_count,
        'listings', v_listings
    );
end;
$$;

grant execute on function public.collect_market_payouts() to authenticated;

-- Função RPC: cancelar oferta e devolver estoque ao cliente
create or replace function public.cancel_market_listing(p_listing_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
    v_seller_id uuid := auth.uid();
    v_listing public.player_market_listings%rowtype;
begin
    if v_seller_id is null then
        return json_build_object('success', false, 'message', 'Usuário não autenticado');
    end if;

    select * into v_listing
    from public.player_market_listings
    where id = p_listing_id
    for update;

    if not found then
        return json_build_object('success', false, 'message', 'Oferta não encontrada');
    end if;

    if v_listing.seller_id <> v_seller_id then
        return json_build_object('success', false, 'message', 'Você não é o vendedor desta oferta');
    end if;

    if v_listing.status <> 'active' then
        return json_build_object('success', false, 'message', 'Oferta não está ativa');
    end if;

    update public.player_market_listings
    set status = 'cancelled'
    where id = p_listing_id
    returning * into v_listing;

    return json_build_object('success', true, 'listing', row_to_json(v_listing));
end;
$$;

grant execute on function public.cancel_market_listing(uuid) to authenticated;

-- Job housekeeping: expirar ofertas antigas (executar periodicamente por trigger/cron)
create or replace function public.expire_old_market_listings()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
    v_count int;
begin
    update public.player_market_listings
    set status = 'expired'
    where status = 'active'
      and expires_at < now();
    get diagnostics v_count = row_count;
    return v_count;
end;
$$;

grant execute on function public.expire_old_market_listings() to authenticated;

comment on table public.player_market_listings is 'Ofertas de produtos entre jogadores (Mercado P2P)';
comment on function public.purchase_market_listing(uuid) is 'Compra atômica de oferta no Mercado P2P';
comment on function public.collect_market_payouts() is 'Credita pagamentos pendentes de ofertas vendidas pelo jogador';
comment on function public.cancel_market_listing(uuid) is 'Cancela oferta ativa do próprio jogador';
