# V2 Build Status — Revenue Intelligence Edition

Branch: `feat/v2-revenue-intelligence` · Logs: `/tmp/*.log`

- [x] **Phase 0** — Recon, `ARCHITECTURE_AUDIT.md`, `STATUS.md`, branch, commit
- [x] **Phase 1** — AI Sales Playbooks & Deal Risk Radar
  - [x] `0004` migration: `playbooks`, `insights` score columns, composite indexes
  - [x] Seed + onboarding auto-provision (BANT EN, B2B Qualification HE)
  - [x] Extraction: weighted `deal_health_score`, `risk_flags`, `playbook_results`
  - [x] `POST /api/calls/[id]/reanalyze`
  - [x] `/settings/playbooks`, Deal Health Gauge + Risk Radar + Scorecard on `/calls/[id]`
  - [x] Dashboard At-Risk + Avg Adherence KPI
  - Verifier: tsc ✅ · tests 19/19 ✅ · build ✅ · no new secret/RLS exposure · RTL dir="auto" on all new text
- [x] **Phase 2** — Zero-touch ingestion
  - [x] `workspace_api_keys` (SHA-256 hashed, service-role-only RLS)
  - [x] `POST /api/webhooks/calls/ingest` (Bearer, timingSafeEqual, dedupe, SSRF-guarded, 202)
  - [x] `/settings/webhooks` (generate/revoke, copy-once secret, snippets, test button)
  - Verifier: tsc ✅ · tests 19/19 ✅ · build ✅ · key_hash never client-selected · SSRF guard on recording_url
  - Security review fixes: IPv6 SSRF fail-closed allowlist, alert fetch `redirect:"manual"`, playbooks RLS → member-read/service-role-write
- [~] **Phase 3** — Synced player, search, export (PARTIAL — usage limit hit)
  - [x] Audio ↔ transcript sync (click-to-seek, active highlight, 1x–2x speed, keyword search/highlight) on `/calls/[id]`
  - [x] `GET /api/calls/export?format=csv|json` (RLS-scoped, RFC-4180 escaping) — **export button on `/calls` still TODO**
  - [ ] `/calls` multi-facet URL-param filters (sentiment, risk, language, CRM sync) — NOT DONE
  - Verifier: tsc ✅ · build ✅ (tests not expanded yet)
  - Also applied: anchored IPv6 SSRF regex fix (second security-review pass)
- [ ] **Phase 4** — Alerts & weekly digest
  - [ ] `workspace_alert_rules` + `/settings/alerts` + finalize dispatch
  - [ ] `GET /api/digest/weekly` + dashboard drawer
- [ ] **Phase 5** — Hardening, 35+ tests, push
  - [ ] Rate limiting + SSRF guard
  - [ ] Vitest 35+
  - [ ] Verify green + docs + merge/push
