# Rebuild Instructions

My❤️Montgomery is designed so judges can rebuild the system easily.

## Requirements
- Node.js 18+
- npm

## Step 1 — Clone Repo
```bash
git clone https://github.com/ultrav10let-builder/my_montgomery
cd my_montgomery
```

## Step 2 — Install Dependencies
```bash
npm install
```

## Step 3 — Create Gemini API Key
1. Open [Google AI Studio](https://aistudio.google.com).
2. Click **Get API Key**.
3. Create a new key and copy it.
*Each key is linked to a Google Cloud project created through AI Studio.*

## Step 4 — Configure Environment Variables
Create a `.env` file:
```env
PORT=8080
BRIGHTDATA_BROWSER_WSS=
OPENAI_API_KEY=
GEMINI_API_KEY=
```
*Use PORT=8080 (Chrome blocks 6000; 8080 is universally safe). Use OPENAI_API_KEY or GEMINI_API_KEY for AI summaries.*

## Step 5 — Start the App
```bash
npm run dev
```
*One command starts both API and frontend. Expected output: `Server running on http://localhost:8080`*

## Step 6 — Open in Browser
**Open: http://localhost:8080**

## Step 7 — Refresh Data
Trigger data refresh:
- `POST /api/refresh/signals`
- `POST /api/refresh/digest`

## Result
You should see:
- City snapshot dashboard
- Interactive civic map
- Daily civic digest
