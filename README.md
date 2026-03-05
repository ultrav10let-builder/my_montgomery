# My❤️Montgomery

### Your City. Clearly Seen.

My❤️Montgomery is a civic intelligence platform that transforms municipal data into accessible insights for residents, journalists, and policymakers.

The platform combines:
- official open civic datasets
- Bright Data live scraping
- AI summarization via Google Gemini (Google AI Studio)
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
Leaflet-powered map visualizing resource demand by neighborhood.
- **Metrics**: signals per 10,000 residents.
- **Layers**: 311 requests, code violations, civic announcements, infrastructure signals.
- **Future layers**: police calls, fire incidents, EMS demand.

### Neighborhood Insight Panel
Clicking a region reveals:
- signals per capita
- difference from city baseline
- dominant issue category
- weekly trend change

### Today in Montgomery
Daily AI-generated civic digest summarizing:
- council agendas
- zoning hearings
- development notices
- city announcements

Summaries are produced using Google Gemini models via Google AI Studio.

## Technology Stack
- **Frontend**: React, Vite, Leaflet
- **Backend**: Node.js, Express, Zod, Helmet
- **AI**: Google Gemini, Google AI Studio, GenAI SDK
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
Gemini AI Summarization
 ↓
JSON Cache
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
   PORT=3000
   BRIGHTDATA_BROWSER_WSS=wss://brd-customer-hl_...:9222
   ADMIN_TOKEN=your-secret-token
   GEMINI_API_KEY=
   ```
   *Gemini API keys are generated in Google AI Studio. `BRIGHTDATA_BROWSER_WSS` is obtained from the Bright Data Scraping Browser proxy settings.*

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

## License
MIT
