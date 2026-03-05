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
React Web App
 ↓
Node.js API
 ↓
Data Connectors
    ├ Open Data Portal
    ├ Bright Data Scraping
 ↓
Trend Engine
 ↓
Google Gemini (AI Studio API)
 ↓
JSON Cache
```

## Data Flow

### Structured Data
**Open Data Portal → API → Cache → Frontend**
- Examples: 311 requests, code violations, infrastructure signals.

### Unstructured Data
**Bright Data → API → Gemini AI → Civic Digest → Frontend**
- Sources: city announcements, council agendas, zoning hearings, development notices.

## AI Integration
Gemini models are accessed through the **Google AI Studio API**.
- **Typical models used**: `gemini-3-flash`
- **Tasks performed**: summarization, signal explanation, trend interpretation.

## Storage Model
Minimal persistent storage.
- **Primary**: `data/latest_signals.json`, `data/digest_today.json`
- **Purpose**: reduce API calls, maintain rebuild reliability, support offline demo.

## Security Model
Secrets stored in `.env`:
- `BRIGHTDATA_API_KEY`
- `GEMINI_API_KEY`
*Never exposed to the frontend.*
