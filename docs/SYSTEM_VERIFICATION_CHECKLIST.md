# My❤️Montgomery — System Verification Checklist

Purpose: Confirm that all current data pipelines, APIs, and dashboard components are working correctly before expanding the AI insight engine.

---

## 1. Server Environment Verification ✅

**Required variables:** `OPENAI_API_KEY` or `GEMINI_API_KEY`, `BRIGHTDATA_BROWSER_WSS` (or `BRIGHTDATA_API_KEY`), `DB_MODE`, `SQLITE_PATH`

### Verification Steps

| Step | Status | Notes |
|------|--------|-------|
| 1. Confirm `.env` exists | ✅ | Copy from `.env.example`; create `.env` locally |
| 2. Variables load in server runtime | ✅ | `dotenv/config` in `server.ts` |
| 3. No secrets exposed to frontend | ✅ | Grep confirms no API keys in `src/` |

**Startup logs** (added for verification):

```
[Env] OPENAI_API_KEY present: true|false
[Env] GEMINI_API_KEY present: true|false
[Env] BrightData configured: true|false
[Env] DB_MODE: sqlite
[Env] SQLITE_PATH: ./data/cache.sqlite
[AI Insight] Live mode: using openai|gemini (key present)
```

**Note:** Project uses `BRIGHTDATA_BROWSER_WSS` (Scraping Browser WSS URL). `BRIGHTDATA_API_KEY` is supported for compatibility.

---

## 2. Database Verification ✅

**Tables present:** `signals`, `snapshots`, `sources`, `digests`, `traffic_feeds`, `insights_cache`

### signals table (actual schema)

| Field | Type | Notes |
|-------|------|-------|
| `event_at_utc` | TEXT | UTC ISO string; used for time-window filters |
| `neighborhood` | TEXT | From source data; used for neighborhood-level aggregates |
| `category` | TEXT | Service category |
| `lat`, `lng` | REAL | For point-in-polygon district assignment |
| `created_at_utc` | TEXT | Record creation time |

**District:** Not stored in `signals`. Council district (District 1–9) is derived at runtime via point-in-polygon on `lat`/`lng` against GeoJSON boundaries. The trend engine’s `getDistrictPressure` groups by `neighborhood` (aliased as district) for neighborhood-level pressure.

### snapshots table (actual schema)

| Field | Type |
|-------|------|
| `snapshot_at_utc` | TEXT |

### Test Query

```sql
SELECT COUNT(*) FROM signals;
```

Expected: `>0` (seed data or ingested data).

---

## 3. Signal Data Ingestion ✅

**Sources:** Montgomery Open Data Portal, BrightData (traffic + digest)

### Startup Log

```
[Data] Signals loaded: X (7d), Y (30d). BrightData events: Z (traffic: T, digest items: D).
[Data] Top categories (7d): category1:n, category2:n, ... Neighborhoods: N.
```

Also available via `GET /api/debug/data-summary` (topCategories, districtCounts, signalsLast7d, signalsLast30d).

### API Test

```http
GET /api/debug/data-summary
```

**Expected response:**

```json
{
  "signalsLast7d": number,
  "signalsLast30d": number,
  "topCategories": [{ "category": "...", "count": number }],
  "districtCounts": [{ "district": "...", "count": number }],
  "brightDataEvents": number
}
```

---

## 4. Time Window Controls ✅

**Controls:** Live, 7 Days, 30 Days, 90 Days, Custom

**Updates:** `TimeControlBar` → `useSignals(timeMode, customRange)` → signals, trends, map, AI insight card all receive windowed data.

---

## 5. Map Functionality ✅

**Behavior:** Markers for signal locations; category filters (Traffic, Infrastructure, Civic, Sanitation, Public Safety, Parks); district polygons.

**Modes:** Pressure (heat), Calls (signals), Resources (stubs).

---

## 6. District Data ✅

**District pressure panel:** `DistrictPressurePanel` shows call counts; status colors (Good/Caution/Attention/High priority). Selecting a district highlights map and filters AI insight.

---

## 7. Trend Engine Verification ✅

**API:** `GET /api/trends?window=7d`

**Trend engine SQLite fields (confirmed):**

| Function | Table | Columns used |
|----------|-------|--------------|
| `getCityMetrics` | signals | `event_at_utc`, `event_time_source` |
| `getTopCategories` | signals | `event_at_utc`, `category`, `event_time_source` |
| `getDistrictPressure` | signals | `event_at_utc`, `neighborhood`, `event_time_source` |
| `getTrendChanges` | signals | `event_at_utc`, `category`, `neighborhood`, `event_time_source` |
| `getRecentEvents` | signals | `event_at_utc`, `raw_json`, `category`, `neighborhood`, `event_time_source` |
| `getSignalsInDistrict` | signals | `event_at_utc`, `lat`, `lng`, `category`, `neighborhood`, `raw_json`, `event_time_source` |
| `getBrightDataEvents` | traffic_feeds, digests | `ingested_at_utc`, `date_key`, `items_json` |

**Response includes:** `windowA.stats.total`, `categoryMovers`, `neighborhoodMovers`, `signalsPer10k`, `overallPercentChange`. District (neighborhood) pressure from `getDistrictPressure()`.

---

## 8. AI Insight System ✅

**Endpoint:** `GET /api/insights?window=7d` (optional `district=3`)

**Response format:**

```json
{ "insight": "text summary" }
```

**Fallback:** When AI keys missing or call fails, deterministic `buildFallbackInsight()` returns a summary from trend data.

---

## 9. Insight Cache ✅

**Table:** `insights_cache`

| Field | Type |
|-------|------|
| id | INTEGER PRIMARY KEY |
| time_window | TEXT (e.g. `7d`, `7d:District 3`) |
| generated_at | TEXT |
| insight | TEXT |

**TTL:** 10 minutes. Cache checked before AI call; no AI call if fresh.

---

## 10. Dashboard Integration ✅

**AI Insight panel:** `AIInsightCard` — loading state, insight display, error fallback ("No insights available for this period"). No blank panel.

---

## System Verification Complete

If all checks pass, the system is ready for the Civic Intelligence Expansion Plan.

### Quick Verification Commands

```bash
# Start server
npm run dev

# In another terminal:
curl http://localhost:8080/api/health
curl http://localhost:8080/api/debug/data-summary
curl "http://localhost:8080/api/trends?window=7d"
curl "http://localhost:8080/api/insights?window=7d"
```
