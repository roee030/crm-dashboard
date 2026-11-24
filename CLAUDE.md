# CLAUDE.md — SignalDesk

> **Working name:** `SignalDesk` (placeholder — rename freely). An AI Conversation
> Intelligence & CRM Analytics platform: transcribe customer calls → extract
> structured sales/support insights → sync to CRM → visualize in an executive dashboard.

This file is the single source of truth for architecture, conventions, and data
model. Read it before writing code. Keep it updated as the system evolves.

---

## 1. Product Overview

| | |
|---|---|
| **What** | B2B Micro-SaaS. Upload/ingest a customer call → high-accuracy diarized transcript → Claude-extracted insights → pushed to HubSpot/Monday → shown in an executive dashboard. |
| **Who** | Sales & customer-success teams, their managers, and RevOps. |
| **Core loop** | Audio in → Transcript → Insights → CRM record updated → Dashboard reflects it. |
| **Languages** | English + Hebrew (RTL-aware UI, multi-language STT). |

---

## 2. Tech Stack (authoritative — do not deviate)

| Layer | Choice |
|---|---|
| Framework | **Next.js 15** (App Router, TypeScript, Server Actions + Route Handlers) |
| Styling | **Tailwind CSS**, `shadcn/ui` primitives |
| Charts | **Tremor** + **Recharts** |
| Backend / DB | **Supabase** — PostgreSQL, Auth, Row-Level Security, Storage (audio) |
| STT | **AssemblyAI** — `speech_models: ["assemblyai-stt-3-7", "universal-2"]` (ordered fallback), `speaker_labels: true` |
| AI insights | **Anthropic Claude** — `claude-sonnet-4-6`, JSON-schema / structured outputs |
| CRM | Modular layer: **HubSpot** + **Monday.com** (REST + webhooks) |
| Validation | **Zod** (shared schemas, API boundaries, AI output parsing) |
| Data fetching | TanStack Query (client) + Server Components (reads) |
| Jobs / async | Supabase webhooks + Next.js Route Handlers; status polling via DB |

> **Model-ID note:** the IDs above are kept exactly as specified. Before go-live,
> confirm each ID is still current in the provider dashboards and bump if needed —
> isolate them in `src/lib/config/models.ts` so a change is one edit.
>
> **AssemblyAI parameter — verified against current SDK/API (Nov 2026):** the request
> field is **`speech_models`** (plural, `string[]`), an *ordered fallback list* — the
> API tries index 0, then falls back to the next. The singular `speech_model` (and the
> `"best"`/`"nano"` aliases) is **deprecated**; prefer the array. We therefore configure
> `speech_models: ["assemblyai-stt-3-7", "universal-2"]`. `config/models.ts` is the
> single place these strings live. ⚠️ Confirm `assemblyai-stt-3-7` resolves in your
> AssemblyAI account at build time — if it 400s, the app logs the rejected id and you
> drop to a known-good value (`universal-2`, or the current top-tier `universal-3-5-pro`)
> without touching call sites.

---

## 3. Folder Structure

```
crm-dashboard/
├─ CLAUDE.md
├─ .env.local                      # secrets (gitignored) — see §7
├─ .env.example                    # committed template, no values
├─ next.config.ts
├─ tailwind.config.ts
├─ components.json                 # shadcn config
├─ supabase/
│  ├─ migrations/                  # SQL migrations (source of truth for schema)
│  ├─ seed.sql                     # dev seed + test fixtures
│  └─ config.toml
└─ src/
   ├─ app/
   │  ├─ (marketing)/              # public landing
   │  ├─ (auth)/                   # login, signup, callback
   │  ├─ (app)/                    # authenticated shell (sidebar + topbar)
   │  │  ├─ dashboard/             # KPIs, charts (Phase 3)
   │  │  ├─ calls/
   │  │  │  ├─ page.tsx            # searchable list
   │  │  │  └─ [id]/page.tsx       # drill-down + speaker transcript
   │  │  ├─ upload/                # audio upload UI
   │  │  └─ settings/
   │  │     └─ integrations/       # CRM OAuth / API keys (Phase 4)
   │  └─ api/
   │     ├─ ingest/route.ts        # audio upload + webhook ingestion entry
   │     ├─ transcription/
   │     │  └─ webhook/route.ts    # AssemblyAI completion callback (prod)
   │     ├─ calls/
   │     │  └─ [id]/sync-status/route.ts  # GET: manual poll fallback (local dev, no tunnel)
   │     ├─ insights/route.ts      # Claude extraction trigger
   │     └─ crm/
   │        ├─ [provider]/webhook/route.ts
   │        └─ sync/route.ts
   ├─ components/
   │  ├─ ui/                       # shadcn primitives
   │  ├─ charts/                   # Tremor/Recharts wrappers
   │  ├─ calls/                    # transcript viewer, call cards
   │  └─ layout/                   # sidebar, topbar, shells
   ├─ lib/
   │  ├─ supabase/                 # server + browser clients, RLS-aware helpers
   │  ├─ assemblyai/               # STT client, job submit, webhook verify
   │  ├─ claude/                   # Anthropic client, schema, extraction prompt
   │  ├─ crm/
   │  │  ├─ types.ts               # CrmProvider interface (the contract)
   │  │  ├─ hubspot.ts             # implements CrmProvider
   │  │  ├─ monday.ts              # implements CrmProvider
   │  │  └─ index.ts               # provider registry / factory
   │  └─ config/models.ts         # all external model/version IDs
   ├─ schemas/                     # Zod schemas (insights, API I/O, forms)
   ├─ types/                       # shared TS types, generated Supabase types
   └─ middleware.ts                # Supabase session refresh + route guards
```

---

## 4. Database Schema

PostgreSQL via Supabase. **Multi-tenant by `workspace_id`.** Every tenant-scoped
table carries `workspace_id` and is protected by RLS: a user may read/write a row
only if they belong to that workspace (`workspace_members`). Migrations in
`supabase/migrations/` are the source of truth — never edit the DB by hand.

### Enums
```sql
call_status      : uploaded | transcribing | transcribed | analyzing | completed | failed
call_direction   : inbound | outbound | unknown
member_role      : owner | admin | member
sentiment_label  : positive | neutral | negative
crm_provider     : hubspot | monday
sync_status      : pending | synced | failed
```

### `users`
Mirrors `auth.users` (Supabase Auth owns identity). App-level profile only.
| column | type | notes |
|---|---|---|
| id | uuid PK | = `auth.users.id` |
| email | text | unique |
| full_name | text | |
| avatar_url | text | |
| created_at | timestamptz | default now() |

### `workspaces`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| name | text | |
| owner_id | uuid FK→users | |
| created_at | timestamptz | |

### `workspace_members` (join + RLS backbone)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| workspace_id | uuid FK→workspaces | |
| user_id | uuid FK→users | |
| role | member_role | default `member` |
| unique | (workspace_id, user_id) | |

### `calls`
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| workspace_id | uuid FK→workspaces | **RLS key** |
| uploaded_by | uuid FK→users | |
| title | text | |
| direction | call_direction | default `unknown` |
| customer_name | text | nullable |
| customer_email | text | nullable — deterministic CRM contact match (Phase 4) |
| customer_phone | text | nullable — deterministic CRM contact match (Phase 4) |
| audio_path | text | Supabase Storage key |
| duration_sec | int | nullable |
| language | text | e.g. `en`, `he` |
| status | call_status | default `uploaded` |
| error_message | text | nullable — failure reason when `status=failed` |
| external_provider_id | text | AssemblyAI transcript id |
| crm_contact_ref | text | nullable, set after sync |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `transcripts`
One row per call (1:1). Full text + structured utterances.
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| call_id | uuid FK→calls (unique) | |
| workspace_id | uuid FK→workspaces | denormalized for RLS |
| provider | text | `assemblyai` |
| model | text | `assemblyai-stt-3-7` / `universal-2` |
| language | text | |
| full_text | text | |
| utterances | jsonb | `[{ speaker, start_ms, end_ms, text }]` (diarized) |
| confidence | numeric | 0–1 |
| created_at | timestamptz | |

### `insights`
Claude extraction output (1:1 with call). Structured, schema-validated.
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| call_id | uuid FK→calls (unique) | |
| workspace_id | uuid FK→workspaces | RLS |
| model | text | `claude-sonnet-4-6` |
| summary | text | |
| sentiment_label | sentiment_label | |
| sentiment_score | numeric | −1.0 … 1.0 |
| objections | jsonb | `[{ text, category }]` |
| action_items | jsonb | `[{ text, owner, due_hint }]` |
| deal_stage_recommendation | text | |
| raw | jsonb | full model response for audit |
| call_coaching | jsonb | cached AI Coach output (scorecard, counters, email) — Phase 5 |
| created_at | timestamptz | |

### `crm_integrations`
One connected CRM per workspace+provider. **Tokens encrypted at rest.**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| workspace_id | uuid FK→workspaces | |
| provider | crm_provider | |
| access_token | text | encrypted (pgsodium/Vault) — never return to client |
| refresh_token | text | encrypted, nullable |
| expires_at | timestamptz | nullable |
| account_label | text | human-readable connected account |
| config | jsonb | provider-specific (pipeline/board ids, field map) |
| is_active | boolean | default true |
| created_at | timestamptz | |
| unique | (workspace_id, provider) | |

### `crm_sync_logs` (supporting — observability for Phase 4)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| workspace_id | uuid FK→workspaces | |
| call_id | uuid FK→calls | |
| provider | crm_provider | |
| status | sync_status | |
| external_ref | text | created/updated CRM object id |
| error | text | nullable |
| created_at | timestamptz | |

**Relationship summary:** `workspaces 1─* workspace_members *─1 users`;
`workspaces 1─* calls 1─1 transcripts`, `calls 1─1 insights`, `calls 1─* crm_sync_logs`;
`workspaces 1─* crm_integrations`.

---

## 5. Core Pipeline (Phase 2 contract)

```
POST /api/ingest
  → store audio in Storage, insert calls row (status=uploaded)
  → submit AssemblyAI job (speaker_labels=true, lang detect, webhook_url)
  → status=transcribing

Transcript ready — two interchangeable paths, same handler logic:
  (prod)  AssemblyAI → POST /api/transcription/webhook  (verify via webhook_auth header)
  (local) GET /api/calls/[id]/sync-status → client.transcripts.get(id)
            → if status=completed, run the same finalize step; if error, status=failed
  → write transcripts row, status=transcribed
  → trigger insight extraction

/api/insights
  → send transcript to Claude with JSON schema (claude-sonnet-4-6)
  → validate with Zod → write insights row, status=completed
  → if workspace has active crm_integration → enqueue CRM sync
```

Each stage updates `calls.status` so the UI can poll/subscribe. Failures set
`status=failed` and record the reason; stages are idempotent and retry-safe.

---

## 6. CRM Integration Layer (Phase 4 contract)

Single interface, many providers — add a CRM by implementing it, nothing else changes:

```ts
// src/lib/crm/types.ts
interface CrmProvider {
  key: 'hubspot' | 'monday';
  logCallNote(ctx, call, insight): Promise<{ externalRef: string }>;
  upsertDealProperties(ctx, mapping): Promise<void>;
  createFollowUpTask(ctx, actionItem): Promise<{ externalRef: string }>;
}
```
- `src/lib/crm/index.ts` is a registry/factory keyed by `crm_provider`.
- Inbound CRM events hit `/api/crm/[provider]/webhook` (two-way sync).
- Credentials come from `crm_integrations`; never log or return tokens.

---

## 7. Environment Variables

Committed as `.env.example` (no values). Real values in `.env.local` (gitignored).
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # server-only, never exposed to client
ASSEMBLYAI_API_KEY=
ASSEMBLYAI_WEBHOOK_SECRET=
ANTHROPIC_API_KEY=
HUBSPOT_CLIENT_ID=
HUBSPOT_CLIENT_SECRET=
MONDAY_CLIENT_ID=
MONDAY_CLIENT_SECRET=
APP_URL=                            # public base URL for webhook callbacks
ENCRYPTION_KEY=                     # for CRM token encryption
```

---

## 8. Conventions & Guardrails

- **TypeScript strict.** No `any` at boundaries — parse external data with Zod.
- **Server vs client:** secrets and provider calls live in Route Handlers / Server
  Actions only. Client components never see service-role keys or CRM tokens.
- **RLS is not optional.** Every tenant table has a policy; the service-role client
  is used only in trusted server code for pipeline writes.
- **Model IDs** live solely in `src/lib/config/models.ts`.
- **Money/trades:** N/A — this app never moves funds.
- **i18n/RTL:** Hebrew content must render RTL; transcript viewer is direction-aware.
- **Migrations only:** schema changes go through `supabase/migrations/`.
- **Naming:** files/dirs `kebab-case`, React components `PascalCase`, DB `snake_case`.
- **Errors:** pipeline stages fail loudly into `calls.status=failed` + a reason; no
  silent catches.

---

## 9. Build Phases

1. **Phase 1 — Setup & Plan** *(this file).* Architecture, structure, schema. ✅
2. **Phase 2 — Core Pipeline.** Ingest → AssemblyAI → Claude → Supabase. ✅
3. **Phase 3 — Dashboard UI + Auth.** KPIs, charts, drill-down, upload, onboarding. ✅
4. **Phase 4 — CRM Sync.** Integrations settings + two-way HubSpot/Monday sync. ✅
5. **Phase 5 — User-Facing AI + Growth.** AI Call Coach, workspace copilot, marketing
   landing + lead capture, token refresh, Vitest suite. ✅

## 10. Phase 5 additions (keep accurate)

**Migrations**
- `0001_init.sql` — base schema, RLS, storage.
- `0002_onboarding.sql` — `handle_new_user` trigger: auto-creates profile + workspace +
  owner membership on signup (so RLS works without `DEV_API_KEY`).
- `0003_ai_features.sql` — `insights.call_coaching jsonb` (cached AI coaching);
  `leads` table (public capture via service role; authenticated read).

**New routes**
- `GET  /` — public marketing landing (`src/app/(marketing)/page.tsx`).
- `POST /api/calls/[id]/coach` — AI scorecard + missed-opportunity counters +
  follow-up email (cached in `insights.call_coaching`).
- `POST /api/ai/chat` — streaming workspace copilot (RLS/workspace-scoped).
- `POST /api/leads` — public lead capture.

**New library code**
- `src/lib/crypto.ts` — AES-256-GCM encrypt/decrypt for CRM tokens.
- `src/lib/transcript-metrics.ts` — deterministic talk-to-listen ratio.
- `src/lib/claude/coach.ts` + `src/schemas/coaching.ts` — coaching extraction.
- `src/lib/crm/*` — `CrmProvider` interface, `hubspot.ts` (OAuth token refresh,
  pure association helpers), `monday.ts`, `oauth.ts`, `integration.ts`.
- `src/lib/demo/sample-calls.ts` — EN/HE sample data for the landing lead magnet.

**Tests** — `tests/*.test.ts` (Vitest): crypto round-trip, insight/coaching Zod +
Hebrew preservation, CRM note/association formatting, talk-ratio math.
Scripts: `npm test`, `npm run typecheck`, `npm run build`.

> Per the execution workflow: Phase 1 required approval before code; all phases approved.

## 11. V2 — Revenue Intelligence (keep accurate)

**Migration `0004_v2_intelligence.sql`**
- `playbooks` (RLS: member SELECT; writes via service role after owner/admin gate) —
  `criteria` jsonb `[{id,key,label,description,weight}]`, `is_default`, `language en|he|both`.
- `insights` + `deal_health_score` (int 0–100, deterministic weighted), `risk_flags` (jsonb),
  `playbook_results` (jsonb map key→{score,evidence,coaching_tip}).
- `workspace_api_keys` (RLS: service-role only) — `key_prefix` + SHA-256 `key_hash`.
- `workspace_alert_rules` (RLS: member SELECT; service-role writes) — `webhook_url`, `triggers`.
- `calls.external_call_id` + unique `(workspace_id, external_call_id)` for ingest dedupe.
- Composite indexes: `insights(workspace_id,sentiment_label)`, `crm_sync_logs(call_id,created_at desc)`.
- `provision_default_playbooks()` called by the onboarding trigger (BANT EN + B2B Qualification HE).

**New routes**
- `POST /api/calls/[id]/reanalyze` — re-score against current playbook.
- `POST /api/webhooks/calls/ingest` — Bearer `sd_live_…`, SSRF-guarded, dedupe, 202.
- `GET /api/calls/export?format=csv|json` — RLS-scoped, formula-injection-safe CSV.
- `GET /api/digest/weekly` — executive weekly brief (RLS-scoped).
- `/settings/playbooks`, `/settings/webhooks`, `/settings/alerts` (admin UIs).

**Key libs**
- `src/lib/playbooks/scoring.ts` (pure `computeDealHealth`), `src/lib/api-keys.ts`
  (hash + `timingSafeEqual`), `src/lib/net/ssrf.ts` (IPv4/IPv6 guard), `src/lib/rate-limit.ts`,
  `src/lib/alerts/*` (dispatch + Slack payload), `src/lib/digest.ts`, `src/lib/csv.ts`.
- Rate limiting on `/api/leads`, `/api/ai/chat`, `/api/webhooks/calls/ingest`.

**Tests:** 60 Vitest (`tests/`), covering scoring, API-key hashing, SSRF, CSV, rate limiter,
alert payloads, transcript sync, schemas + Hebrew RTL.

## 12. Zero-env Demo Mode (keep accurate)

Runs the full app with **no `.env.local`** by falling back to an in-memory bilingual
dataset. `isDemoMode()` (`src/lib/demo/mode.ts`) is true when `DEMO_MODE=true` **or**
`NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` are unset. When false, every
production path (Supabase + RLS, AssemblyAI, Claude, CRM) is unchanged — the demo
layer is inert.

**Library**
- `src/lib/demo/mode.ts` — detection + demo tenant constants.
- `src/lib/demo/data.ts` — `buildDemoData()`: 8 calls (4 HE RTL + 4 EN), transcripts
  (diarized utterances w/ ms timestamps), insights (deal health, risk flags, BANT
  playbook_results, cached coaching), CRM integrations + sync logs, playbooks, API
  keys, alert rule. Returns a fresh deep copy each call.
- `src/lib/demo/client.ts` — in-memory supabase-compatible client (chainable
  select/insert/update/upsert/delete + eq/gte/order/limit/maybeSingle/single,
  `auth.getUser`, `storage.createSignedUrl`). `createServerSupabase` / `createAdminClient`
  return it in demo mode; `middleware.ts` bypasses auth.
- `src/lib/demo/responses.ts` — synthesized copilot/coaching/reanalyze answers
  (Hebrew-aware), derived from the dataset; no external API calls.

**Demo surfaces** — `GET /api/demo/audio/[id]` (real playable WAV w/ Range support),
demo short-circuits in `/api/ai/chat`, `/api/calls/[id]/coach`, `/api/calls/[id]/reanalyze`,
`/api/ingest`, `/api/webhooks/calls/ingest`, `/api/crm/sync`. `DemoBanner` in the (app)
shell; `DemoCta` ("Enter Live Demo") on `/`, `/login`, `/signup`.

**Tests:** 81 Vitest total (21 new in `tests/demo.test.ts`: detection, data integrity,
in-memory client, Hebrew/English copilot synthesis). Guide: `PRODUCT_TOUR_HE.md`.
