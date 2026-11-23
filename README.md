# SignalDesk

AI Conversation Intelligence & CRM Analytics. See [CLAUDE.md](./CLAUDE.md) for
architecture, schema, and conventions.

## Phase 2 — Core Pipeline (done)

```
POST /api/ingest                     → create call + submit AssemblyAI job
AssemblyAI ──(prod)──► POST /api/transcription/webhook ─┐
GET  /api/calls/[id]/sync-status ──(local poll)─────────┴─► shared finalizeCall()
POST /api/insights                   → manually (re)run analysis for a call
```

`finalizeCall()` is idempotent: `transcripts`/`insights` have `UNIQUE(call_id)`
and the Claude step is gated by an atomic single-winner `UPDATE ... WHERE status`
claim, so the webhook and the poller can both fire without duplicating work.

## Local setup

1. **Install & env**
   ```bash
   npm install
   cp .env.example .env.local   # fill in the values below
   ```
   Minimum to run the pipeline locally:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   - `ASSEMBLYAI_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `DEV_API_KEY` — any random string; lets you curl the API before auth/UI exist.
   - Leave `APP_URL` **empty** locally → the pipeline uses polling, no tunnel needed.

2. **Database**
   ```bash
   supabase start
   supabase db reset   # applies migrations/0001_init.sql + seed.sql
   ```
   Seed creates dev workspace `00000000-0000-0000-0000-000000000010`.

3. **Run**
   ```bash
   npm run dev
   ```

## Test the pipeline (no UI needed)

```bash
# 1) Ingest a call from a public audio URL (English or Hebrew both work).
curl -s -X POST http://localhost:3000/api/ingest \
  -H "content-type: application/json" \
  -H "x-dev-api-key: $DEV_API_KEY" \
  -d '{"title":"Demo call","audio_url":"https://assembly.ai/wildfires.mp3"}'
# → { "call_id": "...", "status": "transcribing", "poll": "/api/calls/<id>/sync-status" }

# 2) Poll until completed (drives transcription + insight extraction).
curl -s "http://localhost:3000/api/calls/<call_id>/sync-status" \
  -H "x-dev-api-key: $DEV_API_KEY"
# → status: transcribing → processing → completed; transcript_ready / insights_ready flags

# Or upload a local file instead of a URL:
curl -s -X POST http://localhost:3000/api/ingest \
  -H "x-dev-api-key: $DEV_API_KEY" \
  -F "file=@./call.mp3" -F "title=Uploaded call"
```

Inspect results in Supabase Studio: `calls`, `transcripts` (diarized `utterances`),
`insights` (summary, sentiment, objections, action_items, deal_stage_recommendation).

> **Prod/webhook mode:** set `APP_URL` to a public URL (e.g. an ngrok tunnel) and
> `ASSEMBLYAI_WEBHOOK_SECRET`; AssemblyAI then calls `/api/transcription/webhook`
> and polling becomes optional.

## Phase 3 — Dashboard UI, Auth & Upload (done)

Everything is now testable through the browser — no curl needed.

- **Auth + auto-onboarding:** `/login` and `/signup` (Supabase Auth). A Postgres
  trigger (`migrations/0002_onboarding.sql`) auto-creates a profile, default
  `workspace`, and `owner` membership on signup, so RLS works immediately.
- **Dashboard (`/dashboard`):** KPI grid (total calls, avg sentiment, deals won,
  objections), Top Objections chart, call/conversion trend, and pipeline-by-stage.
- **Calls (`/calls`):** searchable table with status, sentiment, and stage.
- **Upload (`/upload`):** drag-and-drop → `POST /api/ingest` → redirects to the
  drill-down, which **auto-polls** `sync-status` while processing and stops on
  `completed`/`failed` (showing `error_message`).
- **Drill-down (`/calls/[id]`):** server-side signed-URL audio playback, a
  speaker-diarized transcript (`dir="auto"` per line for clean Hebrew + English),
  the insights card, and a Phase-4 "Sync to CRM" placeholder.

### Run it

```bash
supabase start && supabase db reset   # applies migrations + rich demo seed
npm run dev                           # http://localhost:3000
```

**Demo login:** `dev@signaldesk.test` / `devpassword` — the workspace comes
preloaded with 7 sample calls (Hebrew + English) so every chart renders.

> For live signup without email confirmation, disable "Confirm email" in your
> local Supabase Auth settings (or Studio → Authentication → Providers → Email).

## Phase 4 — CRM Integrations & Two-Way Sync (done)

- **Layer:** `src/lib/crm/` — a `CrmProvider` interface with `hubspot.ts` and
  `monday.ts` adapters behind a `getProvider()` factory.
- **Dual auth:** connect with a Private App / Personal **API token** (10 seconds,
  no app review) or standard **OAuth 2.0** (`/api/crm/[provider]/oauth/start` +
  `/callback`). Tokens are encrypted at rest with **AES-256-GCM** (`src/lib/crypto.ts`,
  keyed by `ENCRYPTION_KEY`) and never returned to the client.
- **HubSpot:** finds Contact/Deal by email → phone → name (creates a contact if
  none), logs an engagement **note**, updates the mapped **deal stage**, and
  creates a **task** per action item (verified HUBSPOT_DEFINED association ids).
- **Monday:** finds/creates the board item, posts a formatted **update**, sets the
  mapped **status column**, and adds a **subitem** per action item (GraphQL).
- **Settings (`/settings/integrations`):** owners/admins connect/disconnect,
  **Verify Connection**, pick the live pipeline/board, and toggle **Auto-Sync**.
- **Sync:** the drill-down **Sync to CRM** button → `POST /api/crm/sync`, with
  **sync history** (status, ref, error) from `crm_sync_logs`. `finalize.ts`
  auto-syncs on completion when `auto_sync` is on — every attempt is logged.
- **Inbound:** `/api/crm/[provider]/webhook` verifies signatures (HubSpot v3 HMAC,
  Monday challenge + JWT) and maps events back onto the matching call.

> Needs `ENCRYPTION_KEY` set (any string; a 32-byte base64 value is used directly).
> OAuth also needs the provider `*_CLIENT_ID`/`*_CLIENT_SECRET` and the callback URL
> registered; token mode needs neither.
