# Security Overview

Security focuses on protecting API keys and ensuring trustworthy civic data.

## Secrets Management
Secrets stored in `.env` (never exposed to frontend):
- `GEMINI_API_KEY` — Google AI Studio
- `OPENAI_API_KEY` — OpenAI (optional)
- `BRIGHTDATA_BROWSER_WSS` — Bright Data Scraping Browser WebSocket URL
- `ADMIN_TOKEN` — Required for `POST /api/refresh/digest`

## API Protection
Refresh endpoints use cooldown limits:
- `POST /api/refresh/signals` — 1 minute cooldown
- `POST /api/refresh/digest` — 5 minute cooldown, requires `X-Admin-Token` header

## HTTP Security
**Helmet** middleware:
- XSS protection, frameguard enabled
- CSP disabled in development (for Vite HMR); verify in production.

## Input Validation
**Current:** Partial request validation is in place.
- `server/routes/historicalRoutes.ts` uses **Zod** schemas for `/api/signals`, `/api/trends`, and `/api/digest` query params.
- Some other routes still rely on manual parsing/guards and should be tightened over time.

**Recommendation:** Extend schema-based validation to the remaining important routes (for example admin/refresh and insight-related endpoints) so request handling is consistent across the API.

## Data Integrity
All civic signals include:
- timestamp (`event_at_utc`)
- source URL / dataset origin (via `sources` table)
- confidence and source fields for event time
