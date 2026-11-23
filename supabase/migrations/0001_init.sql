-- SignalDesk — initial schema, RLS, and storage.
-- Source of truth for the DB. Multi-tenant by workspace_id; RLS everywhere.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type call_status     as enum ('uploaded','transcribing','transcribed','analyzing','completed','failed');
create type call_direction  as enum ('inbound','outbound','unknown');
create type member_role      as enum ('owner','admin','member');
create type sentiment_label  as enum ('positive','neutral','negative');
create type crm_provider     as enum ('hubspot','monday');
create type sync_status      as enum ('pending','synced','failed');

-- ---------------------------------------------------------------------------
-- users (app profile mirroring auth.users)
-- ---------------------------------------------------------------------------
create table public.users (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text unique not null,
  full_name  text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- workspaces
-- ---------------------------------------------------------------------------
create table public.workspaces (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner_id   uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- workspace_members (RLS backbone)
-- ---------------------------------------------------------------------------
create table public.workspace_members (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references public.users(id) on delete cascade,
  role         member_role not null default 'member',
  created_at   timestamptz not null default now(),
  unique (workspace_id, user_id)
);
create index on public.workspace_members (user_id);

-- Helper: is the current user a member of this workspace?
-- SECURITY DEFINER so the policy check itself is not subject to RLS recursion.
create or replace function public.is_workspace_member(ws uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- calls
-- ---------------------------------------------------------------------------
create table public.calls (
  id                   uuid primary key default gen_random_uuid(),
  workspace_id         uuid not null references public.workspaces(id) on delete cascade,
  uploaded_by          uuid references public.users(id) on delete set null,
  title                text,
  direction            call_direction not null default 'unknown',
  customer_name        text,
  customer_email       text,
  customer_phone       text,
  audio_path           text,
  duration_sec         int,
  language             text,
  status               call_status not null default 'uploaded',
  error_message        text,
  external_provider_id text,            -- AssemblyAI transcript id
  crm_contact_ref      text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index on public.calls (workspace_id, created_at desc);
create index on public.calls (external_provider_id);

-- ---------------------------------------------------------------------------
-- transcripts (1:1 with calls)
-- ---------------------------------------------------------------------------
create table public.transcripts (
  id           uuid primary key default gen_random_uuid(),
  call_id      uuid not null unique references public.calls(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  provider     text not null default 'assemblyai',
  model        text,
  language     text,
  full_text    text,
  utterances   jsonb not null default '[]'::jsonb,  -- [{speaker,start_ms,end_ms,text}]
  confidence   numeric,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- insights (1:1 with calls)
-- ---------------------------------------------------------------------------
create table public.insights (
  id                        uuid primary key default gen_random_uuid(),
  call_id                   uuid not null unique references public.calls(id) on delete cascade,
  workspace_id              uuid not null references public.workspaces(id) on delete cascade,
  model                     text,
  summary                   text,
  sentiment_label           sentiment_label,
  sentiment_score           numeric,                    -- -1.0 .. 1.0
  objections                jsonb not null default '[]'::jsonb,
  action_items              jsonb not null default '[]'::jsonb,
  deal_stage_recommendation text,
  raw                       jsonb,
  created_at                timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- crm_integrations (one per workspace+provider)
-- ---------------------------------------------------------------------------
create table public.crm_integrations (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null references public.workspaces(id) on delete cascade,
  provider      crm_provider not null,
  access_token  text,           -- encrypted at rest (Phase 4); never returned to client
  refresh_token text,
  expires_at    timestamptz,
  account_label text,
  config        jsonb not null default '{}'::jsonb,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (workspace_id, provider)
);

-- ---------------------------------------------------------------------------
-- crm_sync_logs
-- ---------------------------------------------------------------------------
create table public.crm_sync_logs (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  call_id      uuid references public.calls(id) on delete cascade,
  provider     crm_provider not null,
  status       sync_status not null default 'pending',
  external_ref text,
  error        text,
  created_at   timestamptz not null default now()
);
create index on public.crm_sync_logs (workspace_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at trigger for calls
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger calls_touch_updated_at
  before update on public.calls
  for each row execute function public.touch_updated_at();

-- ===========================================================================
-- Row-Level Security
-- ===========================================================================
alter table public.users             enable row level security;
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;
alter table public.calls             enable row level security;
alter table public.transcripts       enable row level security;
alter table public.insights          enable row level security;
alter table public.crm_integrations  enable row level security;
alter table public.crm_sync_logs     enable row level security;

-- users: a user sees/edits only their own row.
create policy users_self_select on public.users
  for select using (id = auth.uid());
create policy users_self_update on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

-- workspaces: visible to members; creatable by the authenticated owner.
create policy workspaces_member_select on public.workspaces
  for select using (public.is_workspace_member(id));
create policy workspaces_owner_insert on public.workspaces
  for insert with check (owner_id = auth.uid());
create policy workspaces_owner_update on public.workspaces
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- workspace_members: a user can see membership rows of workspaces they belong to;
-- can see their own row directly (avoids recursion on first insert).
create policy members_self_select on public.workspace_members
  for select using (user_id = auth.uid() or public.is_workspace_member(workspace_id));

-- Tenant tables: full access limited to workspace members.
create policy calls_rw on public.calls
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy transcripts_rw on public.transcripts
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy insights_rw on public.insights
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

-- crm_integrations: members may manage config; tokens are stripped before leaving
-- the server, never selected into client responses (enforced in app layer).
create policy crm_integrations_rw on public.crm_integrations
  for all using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy crm_sync_logs_select on public.crm_sync_logs
  for select using (public.is_workspace_member(workspace_id));

-- NOTE: the pipeline writes with the service-role key, which bypasses RLS.
-- These policies govern the user-scoped (anon/auth) client used by the UI.

-- ===========================================================================
-- Storage: private bucket for call audio
-- ===========================================================================
insert into storage.buckets (id, name, public)
values ('call-audio', 'call-audio', false)
on conflict (id) do nothing;

-- Members may read/write objects whose top-level folder is a workspace they belong to.
-- Convention: audio_path = '<workspace_id>/<call_id>.<ext>'.
create policy "call-audio members read" on storage.objects
  for select using (
    bucket_id = 'call-audio'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );
create policy "call-audio members write" on storage.objects
  for insert with check (
    bucket_id = 'call-audio'
    and public.is_workspace_member(((storage.foldername(name))[1])::uuid)
  );
