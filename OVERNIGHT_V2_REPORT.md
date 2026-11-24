# 🌙 Overnight V2 Report — SignalDesk Revenue Intelligence Edition

**Status: ✅ All 5 phases complete. Gate green. Merged to `main`.**

Branch `feat/v2-revenue-intelligence` → merged into `main` and pushed to
https://github.com/roee030/crm-dashboard.git

---

## What shipped (Phases 0–5)

### Phase 1 — AI Sales Playbooks & Deal Risk Radar
- `playbooks` table with editable criteria/weights; two defaults auto-provisioned on
  signup (BANT Discovery EN, B2B Qualification HE).
- Claude scores each criterion (0–2) with verbatim transcript evidence; **deterministic
  weighted `deal_health_score` (0–100)** computed in code (`src/lib/playbooks/scoring.ts`);
  concrete `risk_flags` (missing decision-maker, no next step, unaddressed price, competitor).
- UI: Deal Health gauge + Risk Radar + Playbook Scorecard on `/calls/[id]`; At-Risk Deals +
  Avg Playbook Adherence on `/dashboard`; `/settings/playbooks` editor. `POST /reanalyze`.

### Phase 2 — Zero-Touch Ingestion
- `workspace_api_keys` (SHA-256 hashed, service-role-only); constant-time verification.
- `POST /api/webhooks/calls/ingest` — `Bearer sd_live_…`, SSRF-guarded `recording_url`,
  `(workspace_id, external_call_id)` dedupe, 202 + status URL.
- `/settings/webhooks`: generate/revoke keys (secret shown once), cURL/Make/Zapier/Twilio
  snippets, "Send test webhook call".

### Phase 3 — Synced Player, Filters, Export
- `/calls/[id]`: click-to-seek, active-utterance highlight, 1x–2x speed, in-transcript
  keyword search/highlight, `dir="auto"` per utterance.
- `/calls`: SSR URL-param filters (search, sentiment, risk, language, CRM sync) + columns.
- `GET /api/calls/export?format=csv|json` — RLS-scoped, RFC-4180 + formula-injection guard.

### Phase 4 — Smart Alerts & Weekly Digest
- `/settings/alerts`: outbound webhook (Slack/Teams/Make/Custom), 3 triggers, Send Test Alert.
  Dispatch fires fire-and-forget from `finalize.ts` (never breaks the pipeline).
- `GET /api/digest/weekly` (RLS-scoped) + Weekly Executive Brief drawer on `/dashboard`
  (7d calls, WoW sentiment delta, top objections, at-risk deals, best/worst criteria; EN/HE + copy).

### Phase 5 — Hardening, Tests, Docs
- Rate limiting (`src/lib/rate-limit.ts`) on `/api/leads`, `/api/ai/chat`,
  `/api/webhooks/calls/ingest`.
- SSRF guard (`src/lib/net/ssrf.ts`) blocking loopback/private/link-local/metadata (IPv4 + IPv6).

---

## Security audit results

All findings from the automated reviewer during this build were addressed:
- Unscanned Phase-3 commit audited → added **CSV formula-injection** guard to `csvEscape`;
  confirmed export route is RLS-scoped with no secret columns.
- **Playbooks RLS** tightened to member-read / service-role-write.
- **SSRF**: IPv6 parsing hardened (anchored IPv4-mapped regex, fail-closed 2000::/3 allowlist);
  alert fetches use `redirect:"manual"`; `sendTestAlert` returns a **generic** result (no upstream
  status/body oracle).
- API keys stored only as SHA-256 hashes; `key_hash` never selected into client queries.
- **Residual (documented):** DNS-rebinding TOCTOU on outbound webhook fetches is not fully
  closed — production should pin the connection to the validated IP via a custom undici
  dispatcher or an egress proxy.

## Verification gate

| Gate | Result |
|---|---|
| `npm test` | ✅ **60 passed / 60** (11 files) |
| `npx tsc --noEmit` | ✅ exit 0 |
| `npx next build` | ✅ exit 0 (28 routes) |

New test coverage: weighted deal-health & playbook eval, API-key hashing & `timingSafeEqual`,
SSRF IPv4/IPv6 guard, synced utterance matching, CSV escaping + injection, rate limiter,
Slack alert payloads, schemas + Hebrew RTL preservation.

---

## ⏱️ 5-minute morning live-testing checklist

```bash
cp .env.example .env.local   # fill Supabase + ASSEMBLYAI_API_KEY + ANTHROPIC_API_KEY + ENCRYPTION_KEY
supabase start && supabase db reset   # applies 0001–0004 + demo seed (incl. playbooks + scores)
npm run dev                           # http://localhost:3000
```

1. **Login** `dev@signaldesk.test` / `devpassword` → `/dashboard` shows At-Risk Deals, Avg
   Adherence, and the **Weekly Brief** drawer (click it).
2. **Playbooks** `/settings/playbooks` → tweak a weight, Save. Open a call → **Re-analyze** →
   the Deal Health gauge + Scorecard update.
3. **Calls** `/calls` → use the filter bar (risk/sentiment/language/sync) → **Export CSV**.
4. **Webhooks** `/settings/webhooks` → generate a key, copy the cURL snippet, **Send test call**.
5. **Alerts** `/settings/alerts` → paste a Slack Incoming Webhook, pick triggers, **Send test alert**.
6. Any Hebrew call → confirm transcript, insights, and follow-up email render RTL via `dir="auto"`.

> Note on git identity: commits use a neutral author (`SignalDesk <dev@signaldesk.local>`),
> not your personal email. Amend if you prefer your own identity.
