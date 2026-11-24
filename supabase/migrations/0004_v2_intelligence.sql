-- V2 — Revenue Intelligence: playbooks, deal scoring, ingestion keys, alert rules.

-- ===========================================================================
-- Phase 1: Playbooks + deal scoring
-- ===========================================================================
create table if not exists public.playbooks (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null,
  description  text,
  language     text not null default 'en' check (language in ('en','he','both')),
  criteria     jsonb not null default '[]'::jsonb,  -- [{id,key,label,description,weight}]
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists playbooks_workspace_idx on public.playbooks (workspace_id);

alter table public.playbooks enable row level security;
-- Members may READ playbooks (UI). All writes go through the service-role client
-- in server actions that enforce the owner/admin role check, so no client write
-- policy is granted (RLS must not be weaker than the app's authorization gate).
drop policy if exists playbooks_rw on public.playbooks;
drop policy if exists playbooks_read on public.playbooks;
create policy playbooks_read on public.playbooks
  for select using (public.is_workspace_member(workspace_id));

-- Deal scoring columns on insights.
alter table public.insights
  add column if not exists deal_health_score int,
  add column if not exists risk_flags jsonb not null default '[]'::jsonb,
  add column if not exists playbook_results jsonb not null default '{}'::jsonb;

-- Composite indexes for V2 query patterns.
create index if not exists insights_ws_sentiment_idx on public.insights (workspace_id, sentiment_label);
create index if not exists crm_sync_logs_call_created_idx on public.crm_sync_logs (call_id, created_at desc);
-- calls(workspace_id, created_at desc) already created in 0001.

-- Idempotent provisioning of the two default playbooks for a workspace.
create or replace function public.provision_default_playbooks(ws uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.playbooks where workspace_id = ws) then
    return;
  end if;

  insert into public.playbooks (workspace_id, name, description, language, is_default, criteria)
  values (
    ws, 'BANT Discovery', 'Classic BANT qualification for discovery calls.', 'en', true,
    '[
      {"id":"budget","key":"budget","label":"Budget","description":"Did the rep uncover budget / willingness to pay?","weight":25},
      {"id":"authority","key":"authority","label":"Authority","description":"Was the decision-maker identified and engaged?","weight":25},
      {"id":"need","key":"need","label":"Need","description":"Was a concrete pain / need established?","weight":30},
      {"id":"timing","key":"timing","label":"Timing","description":"Was a timeline or next step agreed?","weight":20}
    ]'::jsonb
  );

  insert into public.playbooks (workspace_id, name, description, language, is_default, criteria)
  values (
    ws, 'כשירות מכירה B2B', 'מסגרת כשירות למכירות B2B בעברית.', 'he', false,
    '[
      {"id":"pain","key":"pain","label":"כאב / צורך","description":"האם זוהה כאב עסקי ברור?","weight":30},
      {"id":"decision_maker","key":"decision_maker","label":"מקבל ההחלטות","description":"האם מקבל ההחלטות זוהה ומעורב?","weight":25},
      {"id":"next_step","key":"next_step","label":"צעד הבא","description":"האם סוכם צעד הבא קונקרטי?","weight":25},
      {"id":"competition","key":"competition","label":"תחרות","description":"האם טופלה תחרות / חלופות?","weight":20}
    ]'::jsonb
  );
end;
$$;

-- Onboarding follow-up: provision default playbooks on new-workspace creation.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display_name text;
  ws_id uuid;
begin
  display_name := coalesce(
    nullif(new.raw_user_meta_data->>'full_name', ''),
    split_part(new.email, '@', 1)
  );

  insert into public.users (id, email, full_name)
  values (new.id, new.email, display_name)
  on conflict (id) do nothing;

  if not exists (select 1 from public.workspace_members where user_id = new.id) then
    insert into public.workspaces (name, owner_id)
    values (display_name || '''s Workspace', new.id)
    returning id into ws_id;

    insert into public.workspace_members (workspace_id, user_id, role)
    values (ws_id, new.id, 'owner');

    perform public.provision_default_playbooks(ws_id);
  end if;

  return new;
end;
$$;

-- ===========================================================================
-- Phase 2: Zero-touch ingestion
-- ===========================================================================
-- Caller-supplied id for idempotent inbound ingestion (dedupe).
alter table public.calls add column if not exists external_call_id text;
create unique index if not exists calls_ws_external_call_id_uniq
  on public.calls (workspace_id, external_call_id)
  where external_call_id is not null;

-- Workspace ingestion API keys (hashed; service-role-only)
create table if not exists public.workspace_api_keys (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  label        text,
  key_prefix   text not null,                 -- e.g. "sd_live_abc123" (non-secret, shown in UI)
  key_hash     text not null,                 -- SHA-256 of the full secret; NEVER returned to client
  created_by   uuid references public.users(id) on delete set null,
  last_used_at timestamptz,
  revoked_at   timestamptz,
  created_at   timestamptz not null default now()
);
create index if not exists workspace_api_keys_ws_idx on public.workspace_api_keys (workspace_id);
create index if not exists workspace_api_keys_prefix_idx on public.workspace_api_keys (key_prefix);

-- RLS enabled with NO client policies: the hash must never be selectable from the
-- client. All access (lookup on ingest, list/create/revoke in settings) is through
-- the service-role client in trusted server code.
alter table public.workspace_api_keys enable row level security;

-- ===========================================================================
-- Phase 4: Outbound alert rules
-- ===========================================================================
create table if not exists public.workspace_alert_rules (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  webhook_url  text not null,
  triggers     jsonb not null default '[]'::jsonb,  -- ["on_high_risk_deal","on_negative_sentiment","on_call_completed"]
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);
create index if not exists workspace_alert_rules_ws_idx on public.workspace_alert_rules (workspace_id);

-- The webhook URL is not a secret per se, but writes must be admin-gated in the app.
-- Members may read rules; writes go through the service-role client after a role check.
alter table public.workspace_alert_rules enable row level security;
drop policy if exists alert_rules_read on public.workspace_alert_rules;
create policy alert_rules_read on public.workspace_alert_rules
  for select using (public.is_workspace_member(workspace_id));
