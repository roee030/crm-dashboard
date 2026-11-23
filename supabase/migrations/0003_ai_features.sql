-- Phase 5 — user-facing AI + growth engine.

-- 1) Cached AI coaching output (scorecard, missed opportunities, follow-up email).
alter table public.insights
  add column if not exists call_coaching jsonb;

-- 2) Public lead capture from the marketing landing page.
create table if not exists public.leads (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  name       text,
  company    text,
  message    text,
  source     text default 'landing',
  created_at timestamptz not null default now()
);
create index if not exists leads_created_at_idx on public.leads (created_at desc);

alter table public.leads enable row level security;

-- Inserts happen only via the service-role client in POST /api/leads (RLS bypassed),
-- so no anon INSERT policy is granted. Authenticated users may read captured leads.
drop policy if exists leads_authenticated_read on public.leads;
create policy leads_authenticated_read on public.leads
  for select using (auth.uid() is not null);
