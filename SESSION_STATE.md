# Session State — My❤️Montgomery

**Last updated:** March 2026

Tracks system progress across sessions. Prevents long-session memory decay.

---

## Completed This Session
- **Real data over mock:** All APIs prefer live city data. Mock excluded when real exists; deleted on ingest. `USE_MOCK_WHEN_EMPTY` for demo only.
- **Documentation validated:** ARCHITECTURE, SECURITY, DEPLOYMENT, SOURCES aligned with code
- **Bright Data:** Connection verified; health check uses brdtest.com by default; montgomeryal.gov blocked (Government)
- **CURRENT_STATE.md:** Created — snapshot of what exists vs. claims
- **OUTSTANDING_TASKS.md:** Created — task list aligned with README / MVP / PRD

## Open Items
- Per-capita metrics (blocked on population data)
- Neighborhood Insight Panel (click polygon → panel)
- City Pulse live data (replace hardcode)
- Map layers (toggleable)
- Zod validation on API routes
- Bright Data KYC/allowlist for montgomeryal.gov

## Key Decisions
- Use Census API or static population for per-capita (Montgomery Open Data has none)
- Bright Data health check: default = brdtest.com; `?target=city` for montgomeryal.gov
- Primary storage: SQLite (not JSON)

## File References
- `docs/CURRENT_STATE.md` — validated state
- `docs/OUTSTANDING_TASKS.md` — task list
- `docs/SOURCES.md` — data sources + gaps
- `docs/ARCHITECTURE.md` — corrected storage, model, secrets
