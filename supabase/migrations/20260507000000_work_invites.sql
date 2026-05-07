-- =====================================================================
-- work_invites — Sistema de colaboração entre jogadores
-- =====================================================================

create table if not exists public.work_invites (
  id                uuid        primary key default gen_random_uuid(),
  owner_id          uuid        not null references auth.users(id) on delete cascade,
  owner_name        text        not null,
  -- Snapshot da obra para exibição (id, nome, tipo, tamanhoM2, contractValue, progressPct, efficiencyPct, deadline)
  work_snapshot     jsonb       not null default '{}',
  -- Recursos faltando que o dono precisa ({employees: [{type, quantity, label}], machines: [{typeId, name, quantity}]})
  needed_resources  jsonb       not null default '{}',
  -- Valor fixo que o dono pagará ao colaborador ao concluir a obra
  payment_amount    numeric     not null default 0,
  status            text        not null default 'open'
                    check (status in ('open','accepted','cancelled','completed')),
  collaborator_id   uuid        references auth.users(id) on delete set null,
  collaborator_name text,
  -- Recursos que o colaborador efetivamente contribuiu (para referência no pagamento)
  contributed_resources jsonb   default '{}',
  created_at        timestamptz not null default now(),
  expires_at        timestamptz not null default now() + interval '2 hours',
  completed_at      timestamptz
);

-- Índices
create index if not exists work_invites_owner_idx  on public.work_invites(owner_id);
create index if not exists work_invites_status_idx on public.work_invites(status, expires_at);
create index if not exists work_invites_collab_idx on public.work_invites(collaborator_id);

-- RLS
alter table public.work_invites enable row level security;

-- Qualquer jogador autenticado pode ver convites abertos
create policy "anyone can view open invites"
  on public.work_invites for select
  using (
    auth.uid() is not null
    and (
      status = 'open'
      or owner_id = auth.uid()
      or collaborator_id = auth.uid()
    )
  );

-- Só o dono pode criar convites
create policy "owner can insert"
  on public.work_invites for insert
  with check (auth.uid() = owner_id);

-- Dono pode cancelar/completar; colaborador pode aceitar (update)
create policy "owner or collaborator can update"
  on public.work_invites for update
  using (
    auth.uid() = owner_id
    or auth.uid() = collaborator_id
    or (status = 'open' and auth.uid() is not null)
  );

-- Só o dono pode deletar
create policy "owner can delete"
  on public.work_invites for delete
  using (auth.uid() = owner_id);

-- Realtime
alter publication supabase_realtime add table public.work_invites;
