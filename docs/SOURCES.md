# Montgomery Data Sources

This document lists each dataset and scraped page, which date fields are used, and timezone assumptions.

## Open Data (ArcGIS Hub)

All Open Data sources use **America/Chicago** for date-only values. Date fields are tried in priority order (see `server/time/parseEventTime.ts` and `server/services/ingestService.ts`).

| Label | Hub URL | Primary Date Fields | Timezone | Notes |
|-------|---------|---------------------|----------|-------|
| 311 Service Requests | [Hub Item](https://opendata.montgomeryal.gov/apps/e5004d18034e41e192e89e03601d4c17) | `OPENED_AT`, `created_date`, `CREATED_DATE` | America/Chicago | Request opened date |
| Code Violations | [Hub Item](https://opendata.montgomeryal.gov/apps/0dcb0a26743442168f36c38e3e020300) | `DATE_REPORTED`, `date`, `created_date` | America/Chicago | Violation report date |
| Zoning Cases | [Hub Item](https://opendata.montgomeryal.gov/maps/3b6888b911174bd28c746c737b4006ac) | `date`, `datetime`, `created_date` | America/Chicago | Case date |
| Capital Projects | [Hub Item](https://opendata.montgomeryal.gov/maps/ebd5bd8832b04ce8b87a5accfc3b1526) | `date`, `created_date`, `timestamp` | America/Chicago | Project date |
| Business Licenses | [Hub Item](https://opendata.montgomeryal.gov/apps/989599339fed43138248fb799625ad8c) | `ISSUE_DATE`, `date`, `created_date` | America/Chicago | License issue date |
| Parks & Rec Facilities | [Hub Item](https://opendata.montgomeryal.gov/maps/1dce55228002411ba308638a11bdb813) | `date`, `created_date` | America/Chicago | Static data; date often fallback |
| City Council Districts | [Hub Item](https://opendata.montgomeryal.gov/documents/c0c056626bd449cba2c078f5c49c2650) | `date`, `created_date` | America/Chicago | Boundary data |

## Scraped Civic Sources (Bright Data)

**Connection:** Validated via `GET /api/health/brightdata`. Default uses `geo.brdtest.com` (allowed). Use `?target=city` to test montgomeryal.gov (blocked by Bright Data for Government classification until KYC/allowlist).

Coverage is also exposed at `GET /api/sources/coverage`, which now returns the configured Bright Data source registry, the full open-data hub URL inventory, curated high-value historical datasets, and the tracked source table.

HTML pages are scraped via Playwright + `BRIGHTDATA_BROWSER_WSS`; dates extracted via `parseEventTimeFromHtml` (JSON-LD, meta tags, `<time>`, text patterns). Timezone: inferred from content or assumed America/Chicago when ambiguous.

| Label | URL | Notes |
|-------|-----|-------|
| City News | https://www.montgomeryal.gov/news | General announcements |
| Montgomery Live | https://www.montgomeryal.gov/live | User-provided example of live city updates |
| City Council | https://www.montgomeryal.gov/government/city-government/city-council | Meeting agendas, ordinances |
| City Calendar | https://www.montgomeryal.gov/government/city-government/city-calendar | Meetings, events, public hearings |
| Council District Maps | https://www.montgomeryal.gov/government/city-government/city-council/city-council-district-maps | Official district context and map discovery |
| Planning Dept | https://www.montgomeryal.gov/government/government-transparency/city-planning | Zoning and development |
| Land Use Division | https://www.montgomeryal.gov/government/city-government/city-departments/community-development/land-use-division | Zoning ordinances, rezoning requests |
| Board of Adjustment | https://www.montgomeryal.gov/government/city-government/city-departments/community-development/land-use-division/board-of-adjustment | Zoning hearings, variances |
| Parks & Rec | https://www.montgomeryal.gov/play/explore-montgomery/parks-trails-and-natural-areas/parks | Events, facility news |
| Public Safety | https://www.montgomeryal.gov/city-government/departments/public-safety-test | Police and fire updates |
| Public Safety Test | https://www.montgomeryal.gov/city-government/departments/public-safety-test | User-provided official city URL example |
| Fire Rescue | https://www.montgomeryal.gov/government/city-government/city-departments/fire-rescue | Official fire department source |
| Public Works | https://www.montgomeryal.gov/government/city-government/city-departments/engineering-environmental-services | Road closures, street work |
| Traffic Engineering | https://www.montgomeryal.gov/government/city-government/city-departments/traffic-engineering | Preferred traffic-specific source for closures and detours |
| Sanitation | https://www.montgomeryal.gov/government/city-government/city-departments/sanitation | Preferred sanitation-specific source for collection changes |
| Transparency Policies | https://www.montgomeryal.gov/government/government-transparency/policies | Governance / policy reference source |
| GIS Mapping Tool | https://www.montgomeryal.gov/residents/community/gis-mapping-tool | Official GIS and map discovery |
| Montgomery Open Data | https://opendata.montgomeryal.gov | Dataset discovery root for historical inventory |

### Live Traffic Feeds (Bright Data)

Scraped via same Playwright + `BRIGHTDATA_BROWSER_WSS`. Stored in `traffic_feeds` table. Admin refresh: `POST /api/refresh/traffic` (X-Admin-Token).

| Label | URL | Notes |
|-------|-----|-------|
| ALDOT Closures | https://aldot.511connect.com/Closures | Road closures, incidents |
| ALDOT Main | https://aldot.511connect.com/ | Broader traffic conditions |
| 511 Alabama | https://511.alabama.gov/ | Traffic conditions |
| WSFA 12 | https://www.wsfa.com/news/ | Montgomery-area traffic/news coverage |
| WAKA CBS 8 | https://www.waka.com/news/ | Additional Montgomery-area traffic/news coverage |

## Gaps: Population / Per‑Capita Metrics

The project advertises **"signals per 10,000 residents"** and **"signals per capita"**. These require population by neighborhood, district, or census tract.

**Status:** Montgomery’s Open Data portal does **not** publish population, census, or demographic datasets. Searches (`api/v3/search`) for `population`, `census`, and `demographic` return zero datasets.

**Implemented:** City-wide per-capita uses static population **195,818** (Census July 2024) in `historicalRoutes.ts`. `signalsPer10k` in `/api/trends`; displayed in City Snapshot.

**District-level:** Census API tract/district join would enable per-neighborhood per-capita.

## Snapshot Metadata

Each refresh creates a **snapshot** row with:

- `snapshot_at_utc` – when the refresh ran
- `source` – e.g. hub item id or `mock_311`
- Signals reference `snapshot_id` and carry their own `event_at_utc`, `ingested_at_utc`, `event_time_confidence`, `event_time_source`
