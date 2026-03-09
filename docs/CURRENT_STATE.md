# Current State — Validated as of March 9, 2026

This document reflects the current verified state of My❤️Montgomery after the final demo, accessibility, and claims-alignment passes.

---

## Implemented & Verified

### City Snapshot
- ✅ 311 service request count (`totalRequests`)
- ✅ Change vs matched prior window (`changePercent`)
- ✅ Most active category (`topCategory`)
- ✅ Highest-demand neighborhood (`activeNeighborhood`)
- ✅ AI summary via OpenAI or Gemini when configured

### Interactive Civic Map
- ✅ Leaflet map with OpenStreetMap tiles
- ✅ District overlays plus signal markers and popups
- ✅ Category filter (All, Infrastructure, Sanitation, Public Safety)
- ✅ Primary map modes: `pressure`, `calls`, `resources`
- ✅ Keyboard-accessible district dropdown fallback in addition to map clicks
- ✅ Citywide per-10k context in snapshot/trend summaries
- ⚠️ District per-10k insight is approximate today (even district share until better population splits are added)
- ❌ Distinct toggleable data layers (311 vs code violations vs announcements) are still future work
- ❌ Police, fire, and EMS layers are still future work

### District Insight Panel
- ✅ Always-mounted panel with placeholder state before selection
- ✅ Current scoped signals
- ✅ Approximate signals per 10k
- ✅ Vs-citywide rate comparison
- ✅ Prior matched-window trend context
- ✅ Dominant issue and leading neighborhood activity

### City Pulse
- ✅ Data-backed district pressure highlights derived from current district breakdowns
- ✅ Top-issue context for highlighted districts
- ⚠️ Not a predictive forecasting feature; it reflects current scoped activity

### Today in Montgomery
- ✅ Digest fetched from API (`/api/digest/today`)
- ✅ Admin refresh triggers Bright Data scraping + AI summarization
- ✅ OpenAI (`gpt-5-mini` by default) or Gemini (`gemini-1.5-flash`) support
- ✅ Category filters with button semantics
- ✅ Pause/resume control for digest rotation when multiple items exist
- ⚠️ Some government-site scraping still depends on Bright Data allowlist/KYC conditions

### Data & Backend
- ✅ Montgomery Open Data ingest from ArcGIS Hub sources
- ✅ SQLite primary storage (`data/cache.sqlite`) for `signals`, `snapshots`, `sources`, and `digests`
- ✅ Historical endpoints: `/api/signals`, `/api/trends`, `/api/digest`
- ✅ Compare mode scoped to current dashboard context
- ✅ Zod validation on key historical query routes
- ⚠️ Validation is not yet universal across every route

### Health & Observability
- ✅ System status strip in the dashboard
- ✅ `GET /api/health`
- ✅ `GET /api/health/brightdata`
- ✅ AI provider/status visibility via `/api/ai/status` and `/api/ai/verify`

### Accessibility / 508-Aligned Improvements
- ✅ Skip link and semantic `header` / `main` / `footer` landmarks
- ✅ Accessible time-range button group and labeled custom date inputs
- ✅ Compare toggle exposed as a switch
- ✅ Digest rotation pause/resume control
- ✅ Keyboard district-selection fallback for the map
- ⚠️ No formal Section 508 audit or certification has been completed yet

---

## Current Gaps / Known Limits

| Area | Current status |
|------|----------------|
| Distinct map data layers | Not implemented yet; current map uses one signal set plus category/mode filtering |
| District population precision | District per-capita view is approximate until better district population splits are added |
| Route validation coverage | Stronger than before, but not every route uses schema validation yet |
| Formal 508 compliance claim | Improved alignment, but no formal audit/certification has been performed |
| Bright Data government-source access | Some sources still depend on Bright Data allowlist/KYC behavior |
| Production readiness | Good hackathon/demo quality, but limited CI/CD, monitoring, and load validation |

---

## Tech Stack (Validated)

- **Frontend:** React 19, Vite 6, Leaflet, Tailwind
- **Backend:** Node.js, Express
- **Storage:** SQLite (`better-sqlite3`)
- **AI:** OpenAI (`gpt-5-mini` default) or Gemini (`gemini-1.5-flash`)
- **Scraping:** Playwright + Bright Data Scraping Browser
