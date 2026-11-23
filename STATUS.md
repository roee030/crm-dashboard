# V2 Build Status — Revenue Intelligence Edition

Branch: `feat/v2-revenue-intelligence` · Logs: `/tmp/*.log`

- [x] **Phase 0** — Recon, `ARCHITECTURE_AUDIT.md`, `STATUS.md`, branch, commit
- [ ] **Phase 1** — AI Sales Playbooks & Deal Risk Radar
  - [ ] `0004` migration: `playbooks`, `insights` score columns, composite indexes
  - [ ] Seed + onboarding auto-provision (BANT EN, B2B Qualification HE)
  - [ ] Extraction: weighted `deal_health_score`, `risk_flags`, `playbook_results`
  - [ ] `POST /api/calls/[id]/reanalyze`
  - [ ] `/settings/playbooks`, Deal Health Gauge + Risk Radar + Scorecard on `/calls/[id]`
  - [ ] Dashboard At-Risk + Avg Adherence KPI
- [ ] **Phase 2** — Zero-touch ingestion
  - [ ] `workspace_api_keys` (hashed, service-role-only)
  - [ ] `POST /api/webhooks/calls/ingest` (Bearer, timingSafeEqual, dedupe, 202)
  - [ ] `/settings/webhooks` (generate/revoke, snippets, test button)
- [ ] **Phase 3** — Synced player, search, export
  - [ ] Audio ↔ transcript sync + speed + keyword highlight
  - [ ] `/calls` filters + `GET /api/calls/export?format=csv|json`
- [ ] **Phase 4** — Alerts & weekly digest
  - [ ] `workspace_alert_rules` + `/settings/alerts` + finalize dispatch
  - [ ] `GET /api/digest/weekly` + dashboard drawer
- [ ] **Phase 5** — Hardening, 35+ tests, push
  - [ ] Rate limiting + SSRF guard
  - [ ] Vitest 35+
  - [ ] Verify green + docs + merge/push
