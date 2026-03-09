# Bright Data Integration Verification

## Summary

**Our implementation uses Bright Data Scraping Browser** (Playwright + `BRIGHTDATA_BROWSER_WSS`), not the Crawl API described in `BrightData_CrawlAPI_Integration_Prompt.md`. Both are valid Bright Data products; we use real-time browser scraping for digest generation and live traffic feeds.

---

## 0. 5-Minute Scheduled Scraping (Required for Challenge)

Bright Data is **triggered automatically every 5 minutes** by a server-side scheduler:

| What | Interval | First Run | Env Var |
|------|----------|-----------|---------|
| Traffic feeds | Every 5 min | 30 sec after startup | `BRIGHTDATA_INTERVAL_MINUTES=5` |
| Digest (Today in Montgomery) | Every 5 min | Same run as traffic | |

**Requirements:**
- `BRIGHTDATA_BROWSER_WSS` must be set in `.env` (from Bright Data Scraping Browser zone → Access details)
- Set `BRIGHTDATA_INTERVAL_MINUTES=0` to disable scheduled scraping (admin refresh still works)

**Verification:**
- On startup, look for: `[Bright Data] Scheduled scrape every 5 minutes (traffic + digest).`
- If missing: `[Bright Data] Not configured (BRIGHTDATA_BROWSER_WSS missing).`
- Each run logs: `[Bright Data] Traffic feeds refreshed.` and `[Bright Data] Digest refreshed.` (or errors)
- `GET /api/health/brightdata` tests the connection (default: geo.brdtest.com; `?target=city` for montgomeryal.gov)

---

## 1. Data Sources

### 1a. Digest (Today in Montgomery) – WHITELIST_URLS

| Category | Source URL | Full montgomeryal.gov Location |
|----------|------------|-------------------------------|
| **General** | City News | `https://www.montgomeryal.gov/news` |
| **Civic** | Montgomery Live | `https://www.montgomeryal.gov/live` |
| **Parks** | Parks & Recreation | `https://www.montgomeryal.gov/play/explore-montgomery/parks-trails-and-natural-areas/parks` |
| **Civic** | City Council | `https://www.montgomeryal.gov/government/city-government/city-council` |
| **Civic** | City Calendar | `https://www.montgomeryal.gov/government/city-government/city-calendar` |
| **Civic** | Council District Maps | `https://www.montgomeryal.gov/government/city-government/city-council/city-council-district-maps` |
| **Planning** | Planning Dept | `https://www.montgomeryal.gov/government/government-transparency/city-planning` |
| **Planning** | Land Use | `https://www.montgomeryal.gov/government/city-government/city-departments/community-development/land-use-division` |
| **Planning** | Board of Adjustment | `https://www.montgomeryal.gov/government/city-government/city-departments/community-development/land-use-division/board-of-adjustment` |
| **Infrastructure** | Public Works | `https://www.montgomeryal.gov/government/city-government/city-departments/engineering-environmental-services` |
| **Traffic** | Traffic Engineering | `https://www.montgomeryal.gov/government/city-government/city-departments/traffic-engineering` |
| **Sanitation** | Sanitation | `https://www.montgomeryal.gov/government/city-government/city-departments/sanitation` |
| **Public Safety** | Public Safety | `https://www.montgomeryal.gov/city-government/departments/public-safety-test` |
| **Public Safety** | Public Safety Test | `https://www.montgomeryal.gov/city-government/departments/public-safety-test` |
| **Public Safety** | Fire Rescue | `https://www.montgomeryal.gov/government/city-government/city-departments/fire-rescue` |
| **Civic** | Transparency Policies | `https://www.montgomeryal.gov/government/government-transparency/policies` |
| **GIS** | GIS Mapping Tool | `https://www.montgomeryal.gov/residents/community/gis-mapping-tool` |
| **Civic** | Montgomery Open Data | `https://opendata.montgomeryal.gov` |

**Total: 18 configured source URLs** covering live city pages, department-specific pages, GIS context, transparency pages, and the official open-data portal. Scraped every 5 minutes for real-time news/discovery.

**Card links:** All digest card "View source" links go to external montgomeryal.gov URLs only. localhost and internal URLs are rejected (server + client guard). Source header links are filtered to external gov URLs.

**Pressure boxes (green/yellow/orange/red):** Map polygons are aligned to City Council Districts 1–9. Scores update reactively as signals change. Colors rotate across districts based on signal density (point-in-polygon). District boundaries: `src/data/montgomery_districts.json` (approximate; Bright Data can fetch authoritative GIS when city provides it).

### 1b. Live Traffic Feeds – TRAFFIC_URLS (real-time)

| Label | URL | Data Extracted |
|-------|-----|----------------|
| ALDOT Closures | `https://aldot.511connect.com/Closures` | Road closures, incidents, I-65/I-85/US-80/US-82 |
| ALDOT Main | `https://aldot.511connect.com/` | Traffic conditions, incidents |
| 511 Alabama | `https://511.alabama.gov/` | Traffic conditions, congestion, Montgomery area |
| WSFA 12 | `https://www.wsfa.com/news/` | Crashes, closures, Montgomery-area traffic news |
| WAKA CBS 8 | `https://www.waka.com/news/` | Traffic incidents, Montgomery news |

**Real-time behavior:** Feeds older than 12 hours are purged each run. Stable IDs ensure same incident is replaced, not duplicated. Bright Data scrapes every 5 minutes.

Stored in `traffic_feeds` table. Exposed via `GET /api/traffic/feeds`. Used by Resource Allocation Map (Traffic category) and Live Traffic Feeds panel.

### 1c. District Mapping (Pressure Boxes)

The Resource Allocation Map uses **city council districts 1–9** for pressure colors (green/yellow/orange/red). Polygons in `src/data/montgomery_districts.json` are approximate; Bright Data scrapes district maps and GIS pages for digest content. To fetch authoritative district boundaries, configure Bright Data to scrape the city's GIS/ArcGIS layers when available.

---

## 2. What We Extract Per Page (Scraping Browser)

| Field | Description | Used For |
|-------|-------------|----------|
| `url` | Requested URL | Source mapping |
| `finalUrl` | Actual URL after redirects | **Original source full location** |
| `title` | Page title | Source label, matching |
| `text` | Body text (up to 10,000 chars) | AI extraction |
| `html` | Raw HTML (up to 200,000 chars) | Date parsing, link extraction |
| `headlineLinks` | All `<a href>` with montgomeryal.gov | **Headline → specific page URL mapping** |
| `extractedAt` | Timestamp | Metadata |

---

## 3. Original Source URL Resolution (Full Location)

Each digest item gets a **real montgomeryal.gov URL** via this order:

1. **Item URL** – AI returns exact URL from scraped content
2. **Headline match** – Match item title to `headlineLinks` on the source page → use that link’s URL
3. **Source page** – Match item source to scraped page title → use `finalUrl`
4. **Department aliases** – Map source name (e.g. "CITY CLERK", "PLANNING DEPT") to canonical URL
5. **Category fallback** – Use `CATEGORY_TO_URL[category]` when no other match

**We never invent URLs.** If none match, we show "No Source URL Provided."

---

## 4. Category → Canonical URL Mapping

| Category | Full montgomeryal.gov URL |
|----------|---------------------------|
| Traffic | `https://www.montgomeryal.gov/government/city-government/city-departments/traffic-engineering` |
| Parks | `https://www.montgomeryal.gov/play/explore-montgomery/parks-trails-and-natural-areas/parks` |
| Civic | `https://www.montgomeryal.gov/government/city-government/city-council` |
| Infrastructure | `https://www.montgomeryal.gov/government/city-government/city-departments/engineering-environmental-services` |
| Sanitation | `https://www.montgomeryal.gov/government/city-government/city-departments/sanitation` |
| Public Safety | `https://www.montgomeryal.gov/city-government/departments/public-safety-test` |
| Planning | `https://www.montgomeryal.gov/government/government-transparency/city-planning` |

The audit surface is also available through `GET /api/sources/coverage` for quick verification of configured Bright Data pages, audited historical datasets, and tracked ArcGIS sources.

---

## 5. Crawl API vs Scraping Browser

| Aspect | Crawl API (doc) | Our Implementation |
|--------|-----------------|---------------------|
| **Product** | REST API (trigger, poll, download) | Scraping Browser (Playwright WebSocket) |
| **Auth** | `Authorization: Bearer API_KEY` | `BRIGHTDATA_BROWSER_WSS` |
| **Output** | Batch (json, ndjson, csv) | Real-time per-page |
| **Fields** | markdown, html, ld_json, etc. | text, html, headlineLinks |
| **Use case** | Bulk crawl, scheduled jobs | On-demand digest refresh |

**We are correctly using Scraping Browser** for live digest generation. Crawl API would be an alternative for bulk/historical crawls.

---

## 6. Verification Checklist

- [x] All 7 categories have a canonical montgomeryal.gov URL
- [x] WHITELIST_URLS cover Traffic, Parks, Civic, Infrastructure, Sanitation, Public Safety, Planning
- [x] Each item resolves to a real gov URL (no localhost, no placeholders)
- [x] Headline links extracted for mapping to specific event pages
- [x] Department aliases map common source names to correct URLs
- [x] Category fallback ensures every item gets a URL when possible

---

## 7. Recommendations

1. **Set BRIGHTDATA_BROWSER_WSS** – Get WebSocket URL from Bright Data Scraping Browser zone → Access details. Add to `.env`.
2. **KYC for montgomeryal.gov** – Bright Data may block government sites until allowlisted; traffic (ALDOT 511) typically works; digest may need KYC.
3. **Text limits** – Consider increasing from 10k/200k if pages are truncated.
4. **Crawl API (optional)** – Add Crawl API for batch/scheduled crawls if needed; keep Scraping Browser for real-time scraping.
