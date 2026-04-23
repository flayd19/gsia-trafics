-- ============================================================
-- FIX: Saldo inicial de novos jogadores = R$ 40.000
-- ============================================================
-- O que este SQL faz:
--   1. Atualiza o default da coluna game_progress.money de 15000 -> 40000
--   2. Atualiza o trigger handle_new_user pra inserir money = 40000
--   3. Atualiza o bootstrap defensivo (ensure_user_bootstrap) também
--   4. Dá 40k pra contas que ainda não começaram a jogar (money <= 15000
--      e sem vendas) — evita mexer em quem já evoluiu
-- ============================================================

-- 1) Novo default da coluna
alter table public.game_progress
    alter column money set default 40000;

-- 2) Trigger atualizado pra setar money explicitamente
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

-- 3) Bootstrap defensivo também (caso o trigger não tenha rodado)
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

-- 4) Backfill: quem ainda não fez nada (saldo inicial original 15k e
--    nenhuma venda registrada) ganha o saldo novo.
update public.game_progress
set money = 40000
where money <= 15000
  and coalesce(jsonb_array_length(product_sales), 0) = 0
  and coalesce(jsonb_array_length(vehicle_sales), 0) = 0;

-- 5) Verificação
select
    'default_column' as item,
    column_default as valor
from information_schema.columns
where table_schema = 'public'
  and table_name = 'game_progress'
  and column_name = 'money'
union all
select
    'contas_com_40k',
    count(*)::text
from public.game_progress
where money = 40000;
