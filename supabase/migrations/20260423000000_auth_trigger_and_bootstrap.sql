-- =====================================================================
-- Migration: Trigger de bootstrap de perfil/progresso no cadastro
-- Data: 2026-04-23
-- =====================================================================
-- Cria o trigger `on_auth_user_created` em auth.users que, ao inserir
-- um novo usuário, cria automaticamente:
--   1. player_profiles (display_name vindo do user_metadata)
--   2. game_progress inicial (valores default)
--
-- Isto resolve a race condition do fluxo antigo (client-side fire-and-
-- forget após signup) em que:
--   - signup terminava antes do insert do profile
--   - ou o signup era bloqueado por email confirmation e o createUserProfile
--     nunca era chamado
--   - ou RLS recusava o insert quando chamado antes do auth session estar
--     totalmente propagado
--
-- Como a função roda com SECURITY DEFINER no schema public, ela não sofre
-- das limitações de RLS.
-- =====================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_display_name text;
begin
    -- Tenta extrair display_name do metadata. Fallback: parte local do email.
    v_display_name := coalesce(
        nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
        nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
        split_part(coalesce(new.email, ''), '@', 1),
        'Jogador'
    );

    -- 1) Cria perfil
    insert into public.player_profiles (user_id, display_name)
    values (new.id, v_display_name)
    on conflict (user_id) do nothing;

    -- 2) Cria progresso inicial (se ainda não existir)
    insert into public.game_progress (user_id)
    values (new.id)
    on conflict (user_id) do nothing;

    return new;
end;
$$;

comment on function public.handle_new_user() is
    'Trigger: bootstrap automático de player_profiles + game_progress quando um novo auth.users é inserido';

-- Drop e recria o trigger (idempotente)
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_user();

-- =====================================================================
-- Backfill: para usuários que JÁ existem em auth.users mas sem profile
-- (caso em que o cadastro antigo falhou ou foi interrompido)
-- =====================================================================
insert into public.player_profiles (user_id, display_name)
select
    u.id,
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
-- Helper RPC: garante profile + progress para o user autenticado
-- Pode ser chamado defensivamente pelo client em caso de dúvida.
-- =====================================================================
create or replace function public.ensure_user_bootstrap(p_display_name text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

    insert into public.game_progress (user_id)
    values (v_uid)
    on conflict (user_id) do nothing;
end;
$$;

grant execute on function public.ensure_user_bootstrap(text) to authenticated;

comment on function public.ensure_user_bootstrap(text) is
    'Cliente pode chamar pra garantir que profile+progress existam para o user autenticado';
