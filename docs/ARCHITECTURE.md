# System Architecture

My❤️Montgomery uses a lightweight architecture designed for transparency and reproducibility.

Key design principles:
- live civic data
- minimal infrastructure
- API security
- rebuildability for judges

## Architecture Diagram
```
User
 ↓
React Web App (Vite)
 ↓
Node.js API (Express)
 ↓
Data Connectors
    ├ Montgomery Open Data Portal (ArcGIS Hub)
    ├ Bright Data Scraping Browser (Playwright)
 ↓
Trend Engine (historical queries)
 ↓
AI Summarization (OpenAI or Google Gemini)
 ↓
SQLite + JSON fallback
```

## Data Flow

### Structured Data
**Open Data Portal → ingestService → SQLite → API → Frontend**
- Examples: 311 requests, code violations, zoning cases, capital projects, business licenses, parks, council districts.

### Unstructured Data
**Bright Data Scraping Browser → digestService → AI Summarizer → SQLite digests → Frontend**
- Sources: city news, council, planning, parks, public safety pages.

## AI Integration
Supports **OpenAI** or **Google Gemini**.
- **OpenAI** (when `OPENAI_API_KEY` set): `gpt-5-mini` by default, overridable with `OPENAI_MODEL`
- **Gemini** (when `GEMINI_API_KEY` set): `gemini-1.5-flash`
- **Tasks**: summarization, signal explanation, trend interpretation.

## Storage Model
- **Primary**: SQLite (`data/cache.sqlite`)
- **Tables**: `snapshots`, `signals`, `sources`, `digests`
- **Purpose**: persist ingested data, historical queries, digests.
- **JSON**: Optional fallback/sample files for demo; not primary storage.

## Security Model
Secrets in `.env` (never exposed to frontend):
- `BRIGHTDATA_BROWSER_WSS` — Bright Data Scraping Browser WebSocket URL (for digest scraping)
- `GEMINI_API_KEY` — Google AI Studio
- `OPENAI_API_KEY` — OpenAI (optional alternative)
