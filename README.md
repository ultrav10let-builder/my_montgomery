# My❤️Montgomery

### Your City. Clearly Seen.

My❤️Montgomery is a civic intelligence platform that transforms municipal data into accessible insights for residents, journalists, and policymakers.

The platform combines:
- official open civic datasets
- Bright Data live scraping
- AI summarization via OpenAI or Google Gemini
- geographic visualization

to make civic activity understandable in real time.

## Why This Project Exists
Cities publish enormous amounts of public information, but much of it is scattered across:
- open data portals
- meeting agendas
- development notices
- public announcements

Most residents never see these signals. My❤️Montgomery converts civic data into clear visual insights about what is happening in the city.

## Key Features

### City Snapshot
Instant overview of civic activity.
- **Displays**: 311 service requests, weekly trend changes, most active service categories, highest-demand neighborhoods.

### Interactive Civic Map
Leaflet-powered map visualizing civic signals across Montgomery districts.
- **Views**: District pressure/calls visualization plus a `resources` mode.
- **Context metrics**: Citywide signals per 10,000 residents are shown in snapshot/trend summaries, and district insight adds an approximate district per-10k view until district census splits are added.
- **Layers**: Category filter (All, Infrastructure, Sanitation, Public Safety). Future: distinct data layers.
- **Future layers**: police calls, fire incidents, EMS demand.

### District Insight Panel
Implemented district-scoped insight panel with current scoped signals, approximate per-10k context, citywide baseline comparison, dominant issue, prior-window trend context, and leading neighborhood activity. The panel stays mounted with a neutral placeholder until a district is selected.

### City Pulse
Data-backed district pressure highlights derived from the current district breakdown, with top issue context for the highest-pressure districts in the current scope.

### Today in Montgomery
Daily AI-generated civic digest summarizing:
- council agendas
- zoning hearings
- development notices
- city announcements

Summaries are produced using OpenAI (default: `gpt-5-mini`) or Google Gemini. Configure one or both in `.env`.

## Technology Stack
- **Frontend**: React, Vite, Leaflet
- **Backend**: Node.js, Express, Helmet
- **AI**: OpenAI or Google Gemini (GenAI SDK)
- **Data Collection**: Bright Data, Montgomery Open Data Portal

## Architecture Overview
```
User
 ↓
React Web App
 ↓
Node API
 ↓
Open Data + Bright Data
 ↓
Trend Engine
 ↓
AI Summarization (OpenAI or Gemini)
 ↓
SQLite
```

## Running Locally

1. **Clone repository**
   ```bash
   git clone https://github.com/ultrav10let-builder/my_montgomery
   cd my_montgomery
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create environment file** (`.env`)
   ```env
   PORT=8080
   NODE_ENV=development
   ADMIN_TOKEN=your-secret-admin-token

   # Database (default: SQLite)
   DB_MODE=sqlite
   SQLITE_PATH=./data/cache.sqlite

   # Optional: for full features
   AI_PROVIDER=openai
   OPENAI_API_KEY=
   OPENAI_MODEL=gpt-5-mini
   GEMINI_API_KEY=
   BRIGHTDATA_BROWSER_WSS=   # Bright Data Scraping Browser – for digest scraping
   ```
   *Use one or both AI keys. If your OpenAI account is restricted to a mini model, keep `OPENAI_MODEL=gpt-5-mini`. `GEMINI_API_KEY` comes from [Google AI Studio](https://aistudio.google.com). `BRIGHTDATA_BROWSER_WSS` comes from Bright Data Browser API zone Overview → Access details.*

4. **Start the app**
   ```bash
   npm run dev
   ```
   Open **http://localhost:8080** in your browser.

   **AI Insight mode:** At startup the server logs whether it is in *live mode* (key present) or *fallback mode* (no key). To verify the API key works, call `http://localhost:8080/api/ai/status` and `http://localhost:8080/api/ai/verify`. The status response now includes the active provider and `OPENAI_MODEL` value.

## Testing Historical Queries

The API supports date range and trend endpoints. All dates use **America/Chicago** for local boundaries; data is stored in UTC.

**Signals by date range:**
```bash
curl "http://localhost:8080/api/signals?start=2025-02-01&end=2025-03-05"
# Optional: &category=Infrastructure&neighborhood=Downtown
```

**Trends (last 7 days vs prior 7 days):**
```bash
curl "http://localhost:8080/api/trends?window=7d"
# Or: window=30d
```

**Digest for a specific date:**
```bash
curl "http://localhost:8080/api/digest?date=2025-03-05"
```

**Latest signals (most recent 100):**
```bash
curl "http://localhost:8080/api/signals/latest"
```

## Time Control Bar

- **Live** – Most recent signals
- **7d / 30d** – Last 7 or 30 days by `event_at_utc`
- **Custom** – Date range picker
- **Compare to previous period** – Toggle to show % change vs prior equal window

See `docs/TIME_NORMALIZATION.md` for event time parsing and confidence levels.

## Admin Operations

To refresh the daily digest manually:
1. Open the dashboard.
2. Click the **Refresh (Admin)** icon in the "Today in Montgomery" panel.
3. Enter your `ADMIN_TOKEN` when prompted.
4. The system will connect to Bright Data, scrape the latest civic news, and generate a new AI digest.

## Deployment
- **Frontend**: Vercel
- **Backend**: Render, Railway

## Civic Impact
This project demonstrates how AI and civic data can increase transparency by making public information accessible, understandable, and actionable.

## Feature Roadmap
- See `docs/HACKATHON_FEATURE_ROADMAP.md` for the hackathon-ready roadmap covering:
  - **Live Civic Timeline Engine**
  - **Compare to Previous Period / Montgomery Momentum Compare**

## License
MIT
