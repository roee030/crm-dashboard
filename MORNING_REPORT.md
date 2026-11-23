# ☀️ Morning Report — Phase 5 Autonomous Run

**Status: ✅ All 5 milestones complete. Tests, typecheck, and build are green. Pushed to GitHub.**

Repo: https://github.com/roee030/crm-dashboard.git · branch `main` · commit `08b47d3`

---

## 1. What got built

### Milestone 1 — User-facing AI ("AI Deal Copilot & Call Coach")
- **Talk-to-listen ratio** — deterministic, pure calculator from `transcripts.utterances`
  (`src/lib/transcript-metrics.ts`): per-speaker share, word counts, turns, dominant speaker.
- **AI Call Coach** — `POST /api/calls/[id]/coach` (`src/lib/claude/coach.ts`), cached in the
  new `insights.call_coaching` JSONB column (migration `0003`). Returns:
  - Rep **scorecard** (1–10 + feedback) for Discovery, Objection Handling, Next-Step Closing.
  - **Missed opportunities** with suggested counter-responses to the customer's objections.
  - **One-click follow-up email** written in the call's primary language (Hebrew RTL if the
    call was Hebrew), with a **Copy to Clipboard** button.
  - Rendered in a sleek panel on `/calls/[id]` (`src/components/calls/coach-panel.tsx`,
    `talk-ratio.tsx`).
- **Workspace AI Copilot** — persistent **"Ask AI"** button in the app topbar opens a
  slide-over chat drawer (`src/components/ai/ask-ai-drawer.tsx`). `POST /api/ai/chat` streams
  Claude's answer (Anthropic SDK streaming), **strictly scoped to the user's `workspace_id`**
  (we resolve the workspace from membership and only feed Claude that workspace's calls).
  3 starter chips (EN + HE), `dir="auto"` chat bubbles.

### Milestone 2 — Marketing landing + lead magnet
- `src/app/(marketing)/page.tsx` — hero with dual CTA ("Start Free" → `/signup`,
  "Try Live Demo" → scrolls to the widget), pain-vs-solution, **3-tier pricing**
  (Starter/Growth/Team), FAQ.
- **Live Sample Call Analyzer** (`src/components/marketing/live-analyzer.tsx`) — toggle
  English ↔ Hebrew, inspect diarized transcript, AI insights, follow-up email, and the exact
  **HubSpot/Monday payload** that would be generated.
- **Lead capture** — `leads` table (migration `0003`, RLS: service-role insert, authenticated
  read), `POST /api/leads`, and the "Get early access + free analysis of 5 real sales calls"
  form (`src/components/marketing/lead-form.tsx`).

### Milestone 3 — Hardening + tests
- **HubSpot OAuth token refresh** (`refreshHubspotTokenIfNeeded` in `src/lib/crm/hubspot.ts`):
  when `expires_at` is within 5 minutes, it refreshes via the refresh-token grant and persists
  **re-encrypted** tokens to `crm_integrations`. Wired into `loadCredentials`.
- **Vitest suite** (`tests/`, 19 tests, all passing):
  - AES-256-GCM encrypt/decrypt round-trip incl. Hebrew + tamper detection.
  - Insight & coaching Zod validation + **Hebrew RTL character preservation** (asserts the
    exact code-point sequence survives).
  - HubSpot association-id mapping (202/214/204/216) + note formatting; Monday status JSON.
  - Talk-ratio math (60/40 → 1.5:1, multi-turn aggregation).

### Milestone 4 — Git push
- `git init`, security-checked `.gitignore` (`.env`, `.env.local`, `node_modules`, `.next`
  all ignored; **no secret files present or staged** — only `.env.example`).
- Committed, branch `main`, remote set to the repo URL, pushed `-u origin main`.
- Push succeeded using the authenticated `gh` CLI (account `roee030`) as the git credential
  helper. Verified: `refs/heads/main` on origin at `08b47d3`.

### Milestone 5 — Docs
- `CLAUDE.md` updated: phases, new routes, Phase 5 file map, migrations list,
  `insights.call_coaching` column.
- This report.

---

## 2. Verification results

| Gate | Command | Result |
|---|---|---|
| Unit tests | `npm test` | ✅ **19 passed / 19** (4 files) |
| Types | `npx tsc --noEmit` | ✅ exit 0 |
| Build | `npx next build` | ✅ exit 0 (21 routes) |
| Lint | `npm run lint` | ⏭️ **Skipped** — ESLint is not configured; `next lint` would launch an
  interactive setup that hangs a non-interactive run. Not set up to avoid blocking. See trade-offs. |

---

## 3. Engineering decisions & trade-offs

1. **`/` is now the public landing page.** I deleted the old `src/app/page.tsx` auth-redirect
   so `(marketing)/page.tsx` owns `/`. Logged-in users still reach the app via `/dashboard`
   (sidebar/links). If you'd rather auto-redirect authenticated users off the landing, add a
   check in `(marketing)/page.tsx`.
2. **Git author identity** is a neutral local identity (`SignalDesk <dev@signaldesk.local>`),
   **not** your personal email — I avoid embedding personal contact info in a public remote.
   Amend if you want your own identity: `git commit --amend --author="You <you@email>"`.
3. **ESLint not added.** `next lint` is deprecated in Next 15 and starting it non-interactively
   hangs. Rather than guess a config at 2am, I left it out; `tsc` + `next build` already gate
   types. To add later: `npm i -D eslint eslint-config-next` + a `.eslintrc.json`.
4. **AI chat context is bounded** to the 60 most-recent calls to keep token usage/latency sane.
   For large workspaces, consider retrieval/embeddings instead of stuffing all calls.
5. **Coaching is cached** in `insights.call_coaching` and served from cache unless
   `{ refresh: true }` is posted — avoids paying for Claude on every page view.
6. **Dependency versions:** this environment resolved some packages to unusually high version
   numbers (e.g. `lucide-react`, `vitest@5`, `vite@8`). Installs, tests, and build all pass, so
   I left them; pin to known-good versions if you prefer reproducibility.
7. **Not run against live third-party APIs.** Adapters/coach/chat compile and are unit-tested,
   but HubSpot/Monday/AssemblyAI/Anthropic calls need real keys to exercise end-to-end.

---

## 4. ⏱️ 5-minute morning checklist (local, with live keys)

```bash
# 1) Env
cp .env.example .env.local
#   Fill: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
#         ASSEMBLYAI_API_KEY, ANTHROPIC_API_KEY, ENCRYPTION_KEY (any string; 32-byte base64 ideal)
#   Optional CRM: HUBSPOT_/MONDAY_ CLIENT_ID+SECRET for OAuth (token mode needs none)

# 2) Database (applies 0001+0002+0003 and the demo seed)
supabase start
supabase db reset

# 3) Run
npm run dev            # http://localhost:3000
```

Then:
1. Landing page at `/` → click **Try live demo**, toggle EN/HE, submit the lead form.
2. Sign in at `/login` as **dev@signaldesk.test / devpassword** (7 demo calls preloaded).
3. Open any call → **Generate coaching**, check the talk ratio, copy the follow-up email.
4. Top bar → **Ask AI** → "What are our top 3 pricing objections this month?"
5. `/settings/integrations` → paste a HubSpot/Monday token → **Verify**, pick a board/pipeline,
   toggle **Auto-Sync** → open a call → **Sync to CRM** and watch the sync history.

### If you ever need to re-push manually
```bash
gh auth setup-git          # one-time: use your gh login as git credentials
git push -u origin main
```

---

## 4b. Security review — flagged & fixed (second commit)

An automated security pass flagged 3 issues after the first push. All fixed and re-verified:

1. **[HIGH] Cross-tenant lead PII** (`0003_ai_features.sql`) — the `leads_authenticated_read`
   policy let *any* signed-in user read *every* visitor's email. **Removed** it: `leads` now has
   RLS enabled with **no client policies**; all access is service-role only (insert via
   `/api/leads`, reads via admin tooling).
2. **[MEDIUM] Open redirect** (`src/app/auth/callback/route.ts`) — the `next` param was used
   directly. **Fixed**: only same-origin relative paths (single leading `/`, not `//` or `/\`)
   are accepted, built with `new URL(next, origin)`; otherwise falls back to `/dashboard`.
3. **[MEDIUM] CRM token exposure via RLS** (`0001_init.sql`) — the `crm_integrations_rw` policy
   let workspace members SELECT the (encrypted) token columns from the client. **Removed** the
   client policy: `crm_integrations` is now service-role-only, defense-in-depth on top of the
   AES-256-GCM encryption. The app already only touched this table via the admin client.

Re-verified after fixes: `npm test` ✅ 19/19 · `tsc` ✅ · `next build` ✅.

> Note: I edited migrations `0001`/`0003` in place (source-of-truth; nothing is deployed yet).
> If you've already applied them to a live DB, instead run the equivalent
> `drop policy ...` statements as a new migration.

## 5. Suggested next steps (not done)
- Live end-to-end run with real HubSpot/Monday portals (field/scope quirks).
- Add ESLint config if you want lint in CI.
- Monday OAuth token refresh (only HubSpot refresh was requested/implemented).
- Rate-limit `/api/leads` and `/api/ai/chat`.
- CI workflow running `npm test && npx tsc --noEmit && npm run build`.
