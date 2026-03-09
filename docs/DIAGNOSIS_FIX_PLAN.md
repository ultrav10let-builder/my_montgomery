# My Montgomery — Tree-of-Thought Diagnosis & Fix Plan

**Date:** March 7, 2026  
**Root problem:** User reports "app doesn't work."

---

## 1. All Issues Found (with file:line)

| # | Severity | Location | Issue |
|---|----------|----------|-------|
| 1 | **Critical** | `docs/REBUILD.md` | Wrong port (3001) and URL (5173). Tells users to run `npm run dev` twice. |
| 2 | **High** | `server.ts:298-334` | Duplicate route declarations: `app.get("/api/ai/verify")` and `app.post("/api/ai/summarize")` defined twice (dead code). |
| 3 | **Medium** | `package.json:12` | `"start": "node server.ts"` fails — Node cannot run TypeScript. Should use `tsx` or compiled JS. |
| 4 | **Medium** | `src/hooks/useSignals.ts:45-47` | Trends fetch has no `res.ok` or `content-type` check; HTML/error response causes `json()` to throw. |
| 5 | **Medium** | `src/hooks/useDigest.ts:12-13` | No `res.ok` check before `res.json()`; non-JSON response can throw. |
| 6 | **Low** | `README.md` | No explicit "Open http://localhost:5174" instruction for first-time users. |
| 7 | **Info** | Terminal output | OpenAI 429 (quota exceeded) — AI fails but rest of app works. |
| 8 | **Info** | Terminal output | WebSocket port 24678 conflict — HMR may not work; app still loads. |

---

## 2. Root Cause & Fix for Each

### Issue 1 — REBUILD.md (Critical)
**Root cause:** Docs assume separate frontend (5173) and backend (3001). Actual architecture: single server on PORT (5174) with Vite middleware.

**Fix:**
- Change `PORT=3001` → `PORT=5174` in REBUILD.md .env example.
- Change "API running on localhost:3001" → "Server running on http://localhost:5174".
- Remove Step 6 (second `npm run dev`); single `npm run dev` starts everything.
- Change "Open: http://localhost:5173" → "Open: http://localhost:5174".

### Issue 2 — Duplicate AI routes (High)
**Root cause:** Copy-paste left duplicate `app.get("/api/ai/verify")` and `app.post("/api/ai/summarize")` at lines 298-334. First definitions (76-116) handle requests; second block is unreachable.

**Fix:** Delete lines 297-334 (the duplicate block).

### Issue 3 — package.json start script (Medium)
**Root cause:** `node server.ts` cannot execute TypeScript.

**Fix:** Change to `"start": "tsx server.ts"` or `"start": "node dist/server.js"` (after adding build step for server).

### Issue 4 — useSignals trends fetch (Medium)
**Root cause:** If `/api/trends` returns 404/500 HTML or non-JSON, `trendsRes.json()` throws. Catch runs but signals may be set; trends stays null; UI shows partial/empty state.

**Fix:** Add `res.ok` and `content-type` check before `trendsRes.json()`, similar to signals fetch. On failure, set `trends` to null and continue (don't throw).

### Issue 5 — useDigest (Medium)
**Root cause:** Same as Issue 4 — `res.json()` on HTML/error can throw.

**Fix:** Check `res.ok` and `content-type` before parsing. On failure, set digest to null.

### Issue 6 — README (Low)
**Root cause:** New users may not know which URL to open.

**Fix:** Add after "Running Locally" step 3: "4. **Start the app:** `npm run dev` — then open **http://localhost:5174** in your browser."

### Issue 7 — OpenAI 429 (Info)
**Root cause:** API key quota exceeded. Server catches this and returns user-friendly message; map, signals, trends, digest still work.

**Fix:** Add GEMINI_API_KEY as fallback, or upgrade OpenAI plan. No code change required for graceful degradation.

### Issue 8 — WebSocket port (Info)
**Root cause:** HMR WebSocket port 24678 in use (e.g. another Vite instance).

**Fix:** Set `DISABLE_HMR=true` in .env if HMR causes issues, or kill other Vite processes.

---

## 3. Recommended Port

**5174 is safe.** Chrome blocks: 3659, 4045, 5060-5061, 6000, 6665-6669, 6697. Port 5174 is not in that list.

If 5174 is blocked on the user's system, use **8080** (common, rarely blocked):

```env
PORT=8080
```

Update README, REBUILD.md, and useSignals error messages accordingly.

---

## 4. Step-by-Step Verification

### A. Start server
```powershell
cd c:\Users\Medin\OneDrive\Desktop\Hackathon\my_montgomery
npm run dev
```
**Expected:** `Server running on http://localhost:5174` (or PORT from .env). No crash.

### B. Health check
```powershell
Invoke-RestMethod -Uri "http://localhost:5174/api/health"
```
**Expected:** `{ ok: true, port: 5174 }`

### C. Signals API
```powershell
Invoke-RestMethod -Uri "http://localhost:5174/api/signals?start=2026-02-28&end=2026-03-07"
```
**Expected:** Array of signals (seed data if empty).

### D. Trends API
```powershell
Invoke-RestMethod -Uri "http://localhost:5174/api/trends?window=7d"
```
**Expected:** Object with `windowA`, `windowB`, `categoryMovers`, etc.

### E. Digest API
```powershell
Invoke-RestMethod -Uri "http://localhost:5174/api/digest/today"
```
**Expected:** Object with `items`, `sources`, or mock/demo data.

### F. Open app in browser
1. Open **http://localhost:5174** (not 5173, not 6000).
2. **Expected:** Dashboard loads; map shows markers; City Snapshot shows stats; digest panel shows items.
3. If blank: Open DevTools (F12) → Console. Check for CORS, 404, or wrong-origin errors.

---

## 5. Consolidated Fix Plan (Priority Order)

1. **Fix REBUILD.md** — Correct PORT, URL, remove duplicate npm run dev step.
2. **Remove duplicate AI routes** in `server.ts` (lines 297-334).
3. **Fix package.json start script** — use `tsx server.ts`.
4. **Harden useSignals** — add trends fetch error handling (res.ok, content-type).
5. **Harden useDigest** — add res.ok and content-type check.
6. **Update README** — add explicit "Open http://localhost:5174" step.

---

## Summary

The app **does work** when:
- User runs `npm run dev` once
- User opens **http://localhost:5174** (not 5173 or 6000)
- .env has `PORT=5174`

The most likely "doesn't work" causes:
1. **Wrong URL** — REBUILD.md says 5173; README doesn't clearly say 5174.
2. **Wrong port** — User previously had 6000 (Chrome-blocked); may have old docs.
3. **Duplicate npm run dev** — REBUILD tells users to run it twice (port conflict).
4. **AI 429** — AI summary fails; rest of app works; user may think "nothing works."

Implementing the fixes above will resolve these failure modes.
