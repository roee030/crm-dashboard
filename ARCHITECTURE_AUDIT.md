# Architecture Audit — SignalDesk MVP → Revenue Intelligence (V2)

_Phase 0 recon for the `feat/v2-revenue-intelligence` build._

## Current state (what exists)

- **Stack:** Next.js 15 (App Router, TS), Supabase (Postgres + Auth + RLS + Storage),
  AssemblyAI STT, Claude (`claude-sonnet-4-6`), HubSpot + Monday CRM, Tailwind + Recharts.
- **Migrations:** `0001_init` (schema, RLS, storage), `0002_onboarding` (new-user trigger →
  profile + workspace + owner membership), `0003_ai_features` (`insights.call_coaching`, `leads`).
- **Pipeline:** `finalize.ts` — idempotent (UNIQUE(call_id) + atomic `status='analyzing'` claim);
  AssemblyAI → `extract.ts` (Claude tool-call → Zod) → `insights` → auto CRM sync.
- **CRM layer:** `CrmProvider` interface + `hubspot.ts`/`monday.ts`, AES-256-GCM token
  encryption (`crypto.ts`), OAuth + token mode, token refresh, `crm_sync_logs`.
- **AI UX:** AI Call Coach (`/api/calls/[id]/coach`), streaming workspace copilot
  (`/api/ai/chat`), talk-ratio metrics.
- **App:** auth, dashboard (KPIs + charts), calls list, drill-down, upload, settings/integrations,
  marketing landing + lead capture.
- **Tests:** 19 Vitest unit tests (crypto, schemas+RTL, CRM formatting, talk-ratio).

## Strengths to preserve

1. **Idempotent single-winner finalize** — do not break the atomic claim when adding scoring.
2. **RLS multi-tenancy** via `is_workspace_member()` + service-role-only for secret tables
   (`crm_integrations`, `leads`). New secret tables must follow this pattern.
3. **Zod-at-the-boundary** for all Claude output; JSON-schema is a hint, Zod is the contract.
4. **RTL discipline** — `dir="auto"` per utterance/field; transcript text passed to Claude untouched.
5. **Secrets at rest** — AES-256-GCM; never select secret/hash columns into client queries.

## Gaps (MVP → enterprise Revenue Intelligence)

| Gap | V2 Phase |
|---|---|
| No configurable qualification framework (BANT etc.) | P1 playbooks |
| No quantified deal health / risk surfacing | P1 `deal_health_score` + `risk_flags` |
| No re-scoring when methodology changes | P1 `/reanalyze` |
| Ingestion is UI-only (no API/VoIP/Zapier) | P2 ingestion keys + webhook |
| Audio and transcript are disconnected | P3 synced player |
| No bulk filtering / export for RevOps | P3 filters + CSV/JSON export |
| No proactive alerting | P4 alert rules + dispatch |
| No executive rollup | P4 weekly digest |
| No rate limiting / SSRF guard on ingest | P5 hardening |

## Integration touchpoints (exact)

- `src/schemas/insights.ts` — extend with `deal_health_score`, `risk_flags`, `playbook_results`.
- `src/lib/claude/extract.ts` — accept active playbook; emit scoring; compute deterministic weighted score.
- `src/lib/pipeline/finalize.ts` — load active playbook before extraction; fire alerts (fire-and-forget) after completion.
- `src/types/db.ts` — add `PlaybookRow`, `WorkspaceApiKeyRow`, `WorkspaceAlertRuleRow`; extend `InsightRow`.
- `supabase/migrations/0004_v2_intelligence.sql` — new tables, columns, indexes; onboarding follow-up.
- `src/app/(app)/*` — new `/settings/playbooks`, `/settings/webhooks`, `/settings/alerts`; upgraded `/calls/[id]`, `/calls`, `/dashboard`.
- `src/app/api/*` — `/calls/[id]/reanalyze`, `/webhooks/calls/ingest`, `/calls/export`, `/digest/weekly`.

## Guardrails for this build

- Logs → `/tmp`, tail only. Atomic commit per phase. Verifier pass per phase:
  (a) no cross-tenant RLS leak, (b) no secret/hash in client queries, (c) RTL `dir="auto"` safe,
  (d) `tsc --noEmit` + `npm test` green.
