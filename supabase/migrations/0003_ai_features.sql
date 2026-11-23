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

-- Leads are global marketing PII, NOT workspace-scoped. RLS is enabled with NO
-- client policies: neither anon nor authenticated users may read or write leads.
-- All access goes through the service-role client on the server:
--   * insert  -> POST /api/leads
--   * read    -> admin/staff tooling only (service role)
-- This prevents any signed-in user from reading every other visitor's email.
drop policy if exists leads_authenticated_read on public.leads;
