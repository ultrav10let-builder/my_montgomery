# Security Overview

Security focuses on protecting API keys and ensuring trustworthy civic data.

## Secrets Management
Gemini API keys are generated in Google AI Studio and stored securely.
- **Environment variable example**: `GEMINI_API_KEY=<your_key>`
- The Gemini SDK automatically detects this variable when making requests.

## API Protection
Endpoints protected with rate limits:
- `POST /api/refresh/signals`
- `POST /api/refresh/digest`
- **Default limit**: 3 requests per minute.

## HTTP Security
**Helmet** middleware enforces:
- Content Security Policy
- XSS protection
- frameguard

## Input Validation
All endpoints validated using **Zod**.

## Data Integrity
All civic signals include:
- timestamp
- source URL
- dataset origin
*Ensuring transparency.*
