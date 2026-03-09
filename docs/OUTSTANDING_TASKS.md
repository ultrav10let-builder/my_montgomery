# Outstanding Tasks — README / MVP / PRD Alignment

Tasks to bring the application up to par with documented claims. Ordered by impact and dependency.

---

## Priority 1: Core Feature Gaps (README Claims)

### 1.1 Per-capita metrics (signals per 10,000 residents)
- [x] Static city-wide population (195,818, Census July 2024) — done
- [x] `signalsPer10k` in `/api/trends` and City Snapshot — done
- [ ] Update CivicMap / montgomery.json to use live-derived neighborhood scores (optional; needs district population)

### 1.2 Neighborhood Insight Panel
- [ ] Add click handler to GeoJSON neighborhood polygons
- [ ] Show panel on region click with:
  - signals per capita (or per 10k if population available)
  - difference from city baseline
  - dominant issue category
  - weekly trend change
- [ ] Wire panel to `/api/trends` and neighborhood-aggregated signals

### 1.3 City Pulse — live data
- [ ] Replace hardcoded CityPulse with data from:
  - `/api/trends` (window=7d)
  - Neighborhood-level signal counts
- [ ] Derive "Rising pressure", "Improving", "Persistent" from trend delta

### 1.4 Map layers
- [ ] Implement toggleable layers:
  - 311 requests
  - Code violations
  - Civic announcements (digest items if geo-tagged)
  - Infrastructure signals
- [ ] Optional: police, fire, EMS (requires data sources)

---

## Priority 2: Data & Integration

### 2.1 Bright Data — montgomeryal.gov access
- [ ] Request Bright Data KYC or domain allowlist for montgomeryal.gov
- [ ] Verify digest scraping works end-to-end once allowed

### 2.2 Population data (if not done in 1.1)
- [ ] Integrate Census API or static population for per-capita
- [ ] Document source in SOURCES.md

---

## Priority 3: Quality & Compliance

### 3.1 Input validation (Zod)
- [x] Zod schemas for `GET /api/signals`, `/api/trends`, `/api/digest` — done
- [ ] Optional: validate `X-Admin-Token` on refresh endpoints

### 3.2 Documentation consistency
- [x] README: OpenAI + Gemini, qualified claims, architecture — done
- [x] OPENAI_API_KEY in .env.example — done

---

## Priority 4: Production Readiness

### 4.1 Observability
- [ ] Add health endpoint for DB, AI provider (or document existing)
- [ ] Structured logging for scrape/AI failures
- [ ] Basic error tracking (optional)

### 4.2 Resilience
- [ ] Retry/backoff for AI and scrape calls
- [ ] Graceful degradation when Bright Data or AI unavailable

### 4.3 Deployment
- [ ] CI/CD pipeline (e.g., GitHub Actions)
- [ ] Production env verification (CSP, Helmet)
- [ ] Deployment configs for Vercel + Render/Railway

---

## PRD / MVP Content

**PRD.md** and **MVP.md** are currently placeholders. Consider populating with:
- User stories from README features
- Acceptance criteria for each outstanding task
- MVP scope: P1 items as minimum viable
