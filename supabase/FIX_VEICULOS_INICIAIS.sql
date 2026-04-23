-- ============================================================
-- FIX: Veículo (Monza 1997) + motorista (Felipe) iniciais
-- ============================================================
-- Problema: o trigger handle_new_user estava criando a linha do
-- game_progress com vehicles = '[]' e drivers = '[]' (defaults da
-- coluna). Resultado: algumas contas novas nascem sem Monza.
--
-- Correção:
--   1. handle_new_user e ensure_user_bootstrap passam a inserir o
--      Monza 1997 e o Felipe explicitamente
--   2. Backfill: dá o Monza + Felipe pra quem já cadastrou mas
--      ainda não jogou (sem vendas e frota vazia)
-- ============================================================

-- ============================================================
-- CONSTANTES (replicam INITIAL_VEHICLES e INITIAL_DRIVERS do código)
-- ============================================================
-- Monza 1997: id=monza1, capacity=200, fuelCost=300, price=15000,
--             tripDuration=33.75, breakdownChance=0.10
-- Felipe:     id=felipe, dailyWage=257, inexperiente

-- 1) Trigger atualizado: cria player_profile + game_progress com Monza
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
    insert into public.game_progress (user_id, money, vehicles, drivers)
        values (
            new.id,
            40000,
            '[{
                "id": "monza1",
                "name": "Monza 1997",
                "capacity": 200,
                "fuelCost": 300,
                "price": 15000,
                "assigned": true,
                "driverId": "felipe",
                "active": false,
                "tripDuration": 33.75,
                "breakdownChance": 0.10
            }]'::jsonb,
            '[{
                "id": "felipe",
                "name": "Felipe Mendes",
                "dailyWage": 257,
                "repairDiscount": 0,
                "breakdownChanceModifier": 0.1,
                "seizureChanceModifier": 0.1,
                "speedModifier": 0.05,
                "experience": "iniciante",
                "assigned": true,
                "photo": "/lovable-uploads/4476bcca-8aeb-4119-befe-efb3257ff415.png",
                "description": "Ex-marceneiro, tem 4 filhos com 4 mulheres diferentes. Busca uma renda extra.",
                "vehicles": ["Monza", "Uno"],
                "trait": "Confiável mas inexperiente"
            }]'::jsonb
        )
        on conflict (user_id) do nothing;
    return new;
end;
$$;

-- 2) Bootstrap defensivo (mesmo conteúdo, chamado pelo cliente se o trigger falhar)
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
    insert into public.game_progress (user_id, money, vehicles, drivers)
        values (
            v_uid,
            40000,
            '[{
                "id": "monza1",
                "name": "Monza 1997",
                "capacity": 200,
                "fuelCost": 300,
                "price": 15000,
                "assigned": true,
                "driverId": "felipe",
                "active": false,
                "tripDuration": 33.75,
                "breakdownChance": 0.10
            }]'::jsonb,
            '[{
                "id": "felipe",
                "name": "Felipe Mendes",
                "dailyWage": 257,
                "repairDiscount": 0,
                "breakdownChanceModifier": 0.1,
                "seizureChanceModifier": 0.1,
                "speedModifier": 0.05,
                "experience": "iniciante",
                "assigned": true,
                "photo": "/lovable-uploads/4476bcca-8aeb-4119-befe-efb3257ff415.png",
                "description": "Ex-marceneiro, tem 4 filhos com 4 mulheres diferentes. Busca uma renda extra.",
                "vehicles": ["Monza", "Uno"],
                "trait": "Confiável mas inexperiente"
            }]'::jsonb
        )
        on conflict (user_id) do nothing;
end;
$$;

-- 3) Backfill: quem já tem game_progress mas nasceu sem frota (e ainda
--    não jogou) ganha o Monza + Felipe. Não mexe em quem já tem veículo.
update public.game_progress
set
    vehicles = '[{
        "id": "monza1",
        "name": "Monza 1997",
        "capacity": 200,
        "fuelCost": 300,
        "price": 15000,
        "assigned": true,
        "driverId": "felipe",
        "active": false,
        "tripDuration": 33.75,
        "breakdownChance": 0.10
    }]'::jsonb,
    drivers = '[{
        "id": "felipe",
        "name": "Felipe Mendes",
        "dailyWage": 257,
        "repairDiscount": 0,
        "breakdownChanceModifier": 0.1,
        "seizureChanceModifier": 0.1,
        "speedModifier": 0.05,
        "experience": "iniciante",
        "assigned": true,
        "photo": "/lovable-uploads/4476bcca-8aeb-4119-befe-efb3257ff415.png",
        "description": "Ex-marceneiro, tem 4 filhos com 4 mulheres diferentes. Busca uma renda extra.",
        "vehicles": ["Monza", "Uno"],
        "trait": "Confiável mas inexperiente"
    }]'::jsonb
where coalesce(jsonb_array_length(vehicles), 0) = 0
  and coalesce(jsonb_array_length(drivers), 0) = 0
  and coalesce(jsonb_array_length(product_sales), 0) = 0
  and coalesce(jsonb_array_length(vehicle_sales), 0) = 0
  and (completed_orders is null or completed_orders = 0);

-- 4) Verificação
select
    'contas_com_monza' as item,
    count(*)::text as valor
from public.game_progress
where vehicles @> '[{"id": "monza1"}]'::jsonb
union all
select
    'contas_sem_frota',
    count(*)::text
from public.game_progress
where coalesce(jsonb_array_length(vehicles), 0) = 0;
