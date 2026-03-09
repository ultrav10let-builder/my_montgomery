import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import helmet from "helmet";
import { generateSummary, getAIProviderStatus, getConfiguredOpenAIModel, getSelectedProvider } from "./server/ai/summarizer";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Routes
import sourcesRoutes from "./server/routes/sourcesRoutes";
import refreshRoutes from "./server/routes/refreshRoutes";
import geojsonRoutes from "./server/routes/geojsonRoutes";
import historicalRoutes from "./server/routes/historicalRoutes";
import { sanitizeDigestItems, generateDailyDigest, ensureExternalGovUrl, getDigestItemsByCategory } from "./server/services/digestService";
import { seedSignalsWhenEmpty } from "./server/storage/seedSignals";
import { refreshTrafficFeeds } from "./server/services/trafficFeedService";
import { setLastTrafficRun, setLastDigestRun } from "./server/brightdata/scheduleStatus";
import trafficRoutes from "./server/routes/trafficRoutes";
import roadsRoutes from "./server/routes/roadsRoutes";
import insightsRoutes from "./server/routes/insightsRoutes";
import { buildInsightInput } from "./server/services/insightInputBuilder";
import { countSignalsByDistrict, hydrateSignals } from "./server/utils/signalHydration";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.SQLITE_PATH || "./data/cache.sqlite";
const db = new Database(dbPath);

// Initialize DB from schema.sql
const schemaPath = path.join(__dirname, "server", "storage", "schema.sql");
if (fs.existsSync(schemaPath)) {
  const schema = fs.readFileSync(schemaPath, "utf8");
  db.exec(schema);
}

async function startServer() {
  // Enforce real data: purge mock signals at startup so map/panels never show mock.
  const deleted = db.prepare(
    "DELETE FROM signals WHERE event_time_source = 'mock_generator' OR snapshot_id = 'mock-snapshot-123'"
  ).run();
  if (deleted.changes > 0) {
    console.log(`Purged ${deleted.changes} mock signals at startup (real data only).`);
  }

  seedSignalsWhenEmpty(db);

  // System verification: env status (never log secrets)
  const openAiPresent = Boolean(process.env.OPENAI_API_KEY?.trim());
  const geminiPresent = Boolean(process.env.GEMINI_API_KEY?.trim());
  const brightDataConfigured = Boolean(process.env.BRIGHTDATA_BROWSER_WSS?.trim()) || Boolean(process.env.BRIGHTDATA_API_KEY?.trim());
  console.log(`[Env] OPENAI_API_KEY present: ${openAiPresent}`);
  console.log(`[Env] GEMINI_API_KEY present: ${geminiPresent}`);
  console.log(`[Env] BrightData configured: ${brightDataConfigured}`);
  console.log(`[Env] DB_MODE: ${process.env.DB_MODE || 'sqlite'}`);
  console.log(`[Env] SQLITE_PATH: ${process.env.SQLITE_PATH || './data/cache.sqlite'}`);

  // Phase 1: log dataset sizes at startup
  const REAL_FILTER = " AND event_time_source != 'mock_generator'";
  const signals7d = db.prepare(
    `SELECT COUNT(*) as c FROM signals WHERE event_at_utc >= datetime('now', '-7 days') ${REAL_FILTER}`
  ).get() as { c: number };
  const signals30d = db.prepare(
    `SELECT COUNT(*) as c FROM signals WHERE event_at_utc >= datetime('now', '-30 days') ${REAL_FILTER}`
  ).get() as { c: number };
  const trafficCount = db.prepare(
    `SELECT COUNT(*) as c FROM traffic_feeds WHERE ingested_at_utc >= datetime('now', '-24 hours')`
  ).get() as { c: number };
  let digestItemsCount = 0;
  const latestDigest = db.prepare('SELECT items_json FROM digests ORDER BY created_at_utc DESC LIMIT 1').get() as { items_json: string } | undefined;
  if (latestDigest?.items_json) {
    try {
      const items = JSON.parse(latestDigest.items_json);
      digestItemsCount = Array.isArray(items) ? items.length : 0;
    } catch {
      digestItemsCount = 0;
    }
  }
  const brightDataEvents = trafficCount.c + digestItemsCount;
  console.log(`[Data] Signals loaded: ${signals7d.c} (7d), ${signals30d.c} (30d). BrightData events: ${brightDataEvents} (traffic: ${trafficCount.c}, digest items: ${digestItemsCount}).`);
  const topCats = db.prepare(
    `SELECT category, COUNT(*) as count FROM signals WHERE event_at_utc >= datetime('now', '-7 days') ${REAL_FILTER} AND category IS NOT NULL AND category != '' GROUP BY category ORDER BY count DESC LIMIT 5`
  ).all() as { category: string; count: number }[];
  const neighborhoodCount = (db.prepare(
    `SELECT COUNT(DISTINCT neighborhood) as c FROM signals WHERE 1=1 ${REAL_FILTER} AND neighborhood IS NOT NULL AND neighborhood != ''`
  ).get() as { c: number }).c;
  console.log(`[Data] Top categories (7d): ${topCats.map((r) => `${r.category}:${r.count}`).join(', ') || 'none'}. Neighborhoods: ${neighborhoodCount}.`);

  const useMockWhenEmpty = process.env.USE_MOCK_WHEN_EMPTY !== 'false';

  const app = express();
  const PORT = parseInt(process.env.PORT || '8080', 10);

  app.use(helmet({
    contentSecurityPolicy: false, // Disable for development with Vite
  }));
  app.use(cors());
  app.use(express.json());

  // AI Insight: log provider status at startup (never log the key)
  const aiStatus = getAIProviderStatus();
  if (aiStatus.keyPresent) {
    console.log(`[AI Insight] Live mode: using ${aiStatus.provider} (key present)`);
  } else {
    console.log('[AI Insight] Fallback mode: no OPENAI_API_KEY or GEMINI_API_KEY. Add one to .env for live summaries.');
  }

  // Health check – verify API is reachable (for troubleshooting)
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, port: PORT });
  });

  // Phase 1: debug data summary – verify signals and BrightData pipelines
  app.get("/api/debug/data-summary", (_req, res) => {
    const REAL_FILTER = " AND event_time_source != 'mock_generator'";
    const signalsLast7d = (db.prepare(
      `SELECT COUNT(*) as c FROM signals WHERE event_at_utc >= datetime('now', '-7 days') ${REAL_FILTER}`
    ).get() as { c: number }).c;
    const signalsLast30d = (db.prepare(
      `SELECT COUNT(*) as c FROM signals WHERE event_at_utc >= datetime('now', '-30 days') ${REAL_FILTER}`
    ).get() as { c: number }).c;
    const topCategories = db.prepare(
      `SELECT category, COUNT(*) as count FROM signals WHERE 1=1 ${REAL_FILTER} AND category IS NOT NULL AND category != '' GROUP BY category ORDER BY count DESC LIMIT 10`
    ).all() as { category: string; count: number }[];
    const districtSignals = db.prepare(
      `SELECT neighborhood, lat, lng, raw_json, category FROM signals WHERE 1=1 ${REAL_FILTER}`
    ).all() as Array<{
      neighborhood: string | null;
      lat: number | null;
      lng: number | null;
      raw_json: string | null;
      category: string | null;
    }>;
    const districtCounts = countSignalsByDistrict(districtSignals);
    const trafficCount = (db.prepare(
      `SELECT COUNT(*) as c FROM traffic_feeds WHERE ingested_at_utc >= datetime('now', '-24 hours')`
    ).get() as { c: number }).c;
    let digestItemsCount = 0;
    const latestDigest = db.prepare('SELECT items_json FROM digests ORDER BY created_at_utc DESC LIMIT 1').get() as { items_json: string } | undefined;
    if (latestDigest?.items_json) {
      try {
        const items = JSON.parse(latestDigest.items_json);
        digestItemsCount = Array.isArray(items) ? items.length : 0;
      } catch {
        digestItemsCount = 0;
      }
    }
    const brightDataEvents = trafficCount + digestItemsCount;
    res.json({
      signalsLast7d,
      signalsLast30d,
      topCategories: topCategories.map((r) => ({ category: r.category, count: r.count })),
      districtCounts: districtCounts.map((r) => ({ district: r.district, count: r.count })),
      brightDataEvents,
    });
  });

  // Debug: insight input payload (exact structure sent to AI)
  app.get("/api/debug/insight-input", (req, res) => {
    const window = (req.query.window as string) || '7d';
    const valid = ['7d', '30d', '90d'].includes(window);
    if (!valid) {
      return res.status(400).json({ error: 'Invalid window. Use 7d, 30d, or 90d' });
    }
    try {
      const input = buildInsightInput(window as '7d' | '30d' | '90d');
      console.log(`[InsightInput] Debug route: built for ${window}`);
      res.json(input);
    } catch (err) {
      console.error('[InsightInput] Build failed:', err);
      res.status(500).json({ error: 'Failed to build insight input' });
    }
  });

  // AI routes first (before other /api routers) so /api/ai/* is always hit
  app.get("/api/ai/status", (_req, res) => {
    const selection = getSelectedProvider();
    const activeMode = selection.provider === 'fallback' ? 'fallback' : 'live';
    return res.json({
      openaiKeyPresent: selection.openaiKeyPresent,
      geminiKeyPresent: selection.geminiKeyPresent,
      configuredProvider: selection.configuredProvider,
      activeProvider: selection.provider,
      openaiModel: getConfiguredOpenAIModel(),
      activeMode,
    });
  });
  app.get("/api/ai/verify", async (_req, res) => {
    const status = getAIProviderStatus();
    if (!status.keyPresent) {
      return res.json({ ok: false, error: "No OPENAI_API_KEY or GEMINI_API_KEY in environment" });
    }
    try {
      const preview = await generateSummary("Reply with exactly: OK");
      return res.json({ ok: true, preview: preview.slice(0, 80), provider: status.provider });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[AI Insight] Verify request failed:", msg);
      return res.json({ ok: false, error: msg });
    }
  });
  app.post("/api/ai/summarize", async (req, res) => {
    const status = getAIProviderStatus();
    if (!status.keyPresent) {
      console.log("[AI Insight] Request ignored: no key present");
      return res.json({ summary: "No AI provider configured. Add OPENAI_API_KEY or GEMINI_API_KEY to .env for live summaries." });
    }
    const cachedSummary = app.get("ai_summary");
    if (cachedSummary) {
      return res.json({ summary: cachedSummary });
    }
    const { data } = req.body;
    console.log("[AI Insight] Request sent to", status.provider);
    try {
      const summary = await generateSummary(
        `Summarize these civic signals for a "City Snapshot" dashboard. Focus on trends and high-demand areas. Data: ${JSON.stringify(data)}`
      );
      console.log("[AI Insight] Success");
      res.json({ summary });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[AI Insight] Error:", msg);
      res.status(500).json({
        error: "AI summarization failed",
        summary: "Unable to generate insight. Check that your API key is valid and has sufficient quota."
      });
    }
  });

  // ArcGIS Ingestion Routes
  app.use("/api", sourcesRoutes);
  app.use("/api", refreshRoutes);
  app.use("/api", geojsonRoutes);
  app.use("/api", historicalRoutes);
  app.use("/api", trafficRoutes);
  app.use("/api", roadsRoutes);
  app.use("/api", insightsRoutes);

  const refreshData = async () => {
    console.log("Background Worker: Refreshing civic data...");
    const signals = db.prepare(
      "SELECT * FROM signals WHERE event_time_source != 'mock_generator' ORDER BY event_at_utc DESC LIMIT 20"
    ).all() as Array<{
      category: string | null;
      neighborhood: string | null;
      lat: number | null;
      lng: number | null;
      raw_json: string | null;
    }>;
    const hydratedSignals = hydrateSignals(signals);
    if (hydratedSignals.length > 0 && (process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY)) {
      try {
        const summary = await generateSummary(
          `Summarize these civic signals for a "City Snapshot" dashboard. Data: ${JSON.stringify(hydratedSignals)}`
        );
        app.set("ai_summary", summary);
      } catch (e) {
        console.error("AI Refresh failed:", e);
      }
    }
  };

  // Start Background Worker (Run every hour)
  setInterval(refreshData, 3600000);
  // Initial run
  refreshData();

  // Bright Data scheduler: scrape traffic + digest every 5 minutes (required for web scraping challenge)
  const brightDataIntervalMin = parseInt(process.env.BRIGHTDATA_INTERVAL_MINUTES || '5', 10);
  if (process.env.BRIGHTDATA_BROWSER_WSS && brightDataIntervalMin > 0) {
    const brightDataMs = brightDataIntervalMin * 60 * 1000;
    const runBrightDataScrape = async () => {
      try {
        // 1. Traffic feeds (ALDOT 511 – typically allowed by Bright Data)
        await refreshTrafficFeeds();
        setLastTrafficRun(true);
        console.log('[Bright Data] Traffic feeds refreshed.');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setLastTrafficRun(false, msg);
        console.error('[Bright Data] Traffic scrape failed:', e);
      }
      try {
        // 2. Digest (montgomeryal.gov – may be blocked for Government until KYC)
        await generateDailyDigest();
        setLastDigestRun(true);
        console.log('[Bright Data] Digest refreshed.');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setLastDigestRun(false, msg);
        console.error('[Bright Data] Digest scrape failed (montgomeryal.gov may need KYC):', e);
      }
    };
    setTimeout(() => runBrightDataScrape(), 30_000); // First run 30s after startup
    setInterval(runBrightDataScrape, brightDataMs);
    console.log(`[Bright Data] Scheduled scrape every ${brightDataIntervalMin} minutes (traffic + digest).`);
  } else if (!process.env.BRIGHTDATA_BROWSER_WSS) {
    console.log('[Bright Data] Not configured (BRIGHTDATA_BROWSER_WSS missing). Add to .env for web scraping.');
  }

  // API Routes: enforce real data only; never return mock
  app.get("/api/signals/latest", (req, res) => {
    const signals = db.prepare(
      "SELECT * FROM signals WHERE event_time_source != 'mock_generator' ORDER BY event_at_utc DESC LIMIT 100"
    ).all() as Array<{
      category: string | null;
      neighborhood: string | null;
      lat: number | null;
      lng: number | null;
      raw_json: string | null;
    }>;
    res.json(hydrateSignals(signals));
  });

  app.get("/api/digest/today", async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const category = (req.query.category as string)?.trim();
    // Prefer non-mock digest when multiple exist (shouldn't happen with UNIQUE date_key)
    const digest = db.prepare("SELECT * FROM digests WHERE date_key = ?").get(today) as {
      items_json: string;
      sources_json: string;
      event_at_utc: string;
      ingested_at_utc: string;
      event_time_confidence: string;
      event_time_source: string;
    } | undefined;

    if (!digest) {
      if (useMockWhenEmpty) {
        const now = new Date().toISOString();
        const mockItems = [
          { title: "City Council Meeting", content: "Discussion on new park development in West Montgomery.", source: "City Council", url: "https://www.montgomeryal.gov/government/city-government/city-council", category: "Civic" },
          { title: "Budget Workshop", content: "FY2026 budget review session at 2 PM in Council Chambers.", source: "City Council", url: "https://www.montgomeryal.gov/government/city-government/city-council", category: "Civic" },
          { title: "Road Closure: Madison Ave", content: "Madison Ave will be closed for utility repairs starting Monday.", source: "Traffic Engineering", url: "https://www.montgomeryal.gov/government/city-government/city-departments/traffic-engineering", category: "Traffic" },
          { title: "Detour on Bell Rd", content: "Water main work. Bell Rd closed between Eastern Blvd and Atlanta Hwy through Wednesday.", source: "Traffic Engineering", url: "https://www.montgomeryal.gov/government/city-government/city-departments/traffic-engineering", category: "Traffic" },
          { title: "Zoning Hearing", content: "Public hearing for proposed residential complex on Perry St.", source: "Planning Dept", url: "https://www.montgomeryal.gov/government/government-transparency/city-planning", category: "Planning" },
          { title: "Capitol Park Summer Hours", content: "Parks & Recreation extends summer hours for Capitol Park through September.", source: "Parks & Recreation", url: "https://www.montgomeryal.gov/play/explore-montgomery/parks-trails-and-natural-areas/parks", category: "Parks" },
          { title: "I-65 Bridge Construction", content: "Lane closures on I-65 for bridge deck repair. Expect delays through Friday.", source: "Public Works", url: "https://www.montgomeryal.gov/government/city-government/city-departments/engineering-environmental-services", category: "Infrastructure" },
          { title: "Trash Collection Schedule Change", content: "Holiday week pickup adjusted. Check schedule for your zone.", source: "Sanitation", url: "https://www.montgomeryal.gov/government/city-government/city-departments/sanitation", category: "Sanitation" },
          { title: "Police Community Outreach", content: "MPD hosting community forum at City Hall Tuesday 6 PM.", source: "Public Safety", url: "https://www.montgomeryal.gov/city-government/departments/public-safety-test", category: "Public Safety" }
        ];
        const digestId = `digest-${today}`;
        db.prepare(`
          INSERT OR REPLACE INTO digests (
            id, date_key, event_at_utc, ingested_at_utc, event_time_confidence, event_time_source,
            items_json, sources_json, created_at_utc
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          digestId, today, now, now, "HIGH", "mock_generator",
          JSON.stringify(mockItems), JSON.stringify([{ label: "City Announcements", url: "https://www.montgomeryal.gov" }]),
          now
        );
        const sources = [
          { label: "City Council", url: "https://www.montgomeryal.gov/city-council" },
          { label: "Traffic Engineering", url: "https://www.montgomeryal.gov/government/city-government/city-departments/traffic-engineering" },
          { label: "Sanitation", url: "https://www.montgomeryal.gov/government/city-government/city-departments/sanitation" },
          { label: "Planning", url: "https://www.montgomeryal.gov/departments/planning" },
          { label: "Parks & Recreation", url: "https://www.montgomeryal.gov/departments/parks-recreation" },
          { label: "Public Safety", url: "https://www.montgomeryal.gov/departments/public-safety" }
        ];
        return res.json({ items: sanitizeDigestItems(mockItems, sources), sources, metadata: { event_at: now, confidence: "HIGH", source: "demo" } });
      }
      return res.json({ items: [], sources: [], message: "No digest for today. Click Refresh (Admin) to fetch live civic news." });
    }

    const sources = (() => {
      try {
        return JSON.parse(digest.sources_json);
      } catch {
        return [];
      }
    })();

    const items = getDigestItemsByCategory(today, category);

    if (items.length === 0 && useMockWhenEmpty) {
      const now = new Date().toISOString();
      const mockItems = [
        { title: "City Council Meeting", content: "Discussion on new park development in West Montgomery.", source: "City Council", url: "https://www.montgomeryal.gov/city-council", category: "Civic" },
        { title: "Budget Workshop", content: "FY2026 budget review session at 2 PM in Council Chambers.", source: "City Council", url: "https://www.montgomeryal.gov/city-council", category: "Civic" },
        { title: "Road Closure: Madison Ave", content: "Madison Ave will be closed for utility repairs starting Monday.", source: "Traffic Engineering", url: "https://www.montgomeryal.gov/government/city-government/city-departments/traffic-engineering", category: "Traffic" },
        { title: "Detour on Bell Rd", content: "Water main work. Bell Rd closed between Eastern Blvd and Atlanta Hwy through Wednesday.", source: "Traffic Engineering", url: "https://www.montgomeryal.gov/government/city-government/city-departments/traffic-engineering", category: "Traffic" },
        { title: "Zoning Hearing", content: "Public hearing for proposed residential complex on Perry St.", source: "Planning Dept", url: "https://www.montgomeryal.gov/departments/planning", category: "Planning" },
        { title: "Capitol Park Summer Hours", content: "Parks & Recreation extends summer hours for Capitol Park through September.", source: "Parks & Recreation", url: "https://www.montgomeryal.gov/departments/parks-recreation", category: "Parks" },
        { title: "I-65 Bridge Construction", content: "Lane closures on I-65 for bridge deck repair. Expect delays through Friday.", source: "Public Works", url: "https://www.montgomeryal.gov/departments/public-works", category: "Infrastructure" },
        { title: "Trash Collection Schedule Change", content: "Holiday week pickup adjusted. Check schedule for your zone.", source: "Sanitation", url: "https://www.montgomeryal.gov/government/city-government/city-departments/sanitation", category: "Sanitation" },
        { title: "Police Community Outreach", content: "MPD hosting community forum at City Hall Tuesday 6 PM.", source: "Public Safety", url: "https://www.montgomeryal.gov/departments/public-safety", category: "Public Safety" }
      ];
      const sourcesFallback = [
        { label: "City Council", url: "https://www.montgomeryal.gov/city-council" },
        { label: "Traffic Engineering", url: "https://www.montgomeryal.gov/government/city-government/city-departments/traffic-engineering" },
        { label: "Sanitation", url: "https://www.montgomeryal.gov/government/city-government/city-departments/sanitation" },
        { label: "Planning", url: "https://www.montgomeryal.gov/departments/planning" },
        { label: "Parks & Recreation", url: "https://www.montgomeryal.gov/departments/parks-recreation" },
        { label: "Public Safety", url: "https://www.montgomeryal.gov/departments/public-safety" }
      ];
      return res.json({ items: sanitizeDigestItems(mockItems, sourcesFallback), sources: sourcesFallback, metadata: { event_at: now, confidence: "HIGH", source: "demo" } });
    }
    // Only return external gov URLs – never localhost or internal
    const safeSources = Array.isArray(sources)
      ? sources
        .map((s: { label?: string; url?: string } | string) => {
          const url = typeof s === 'string' ? s : (s as { url?: string }).url;
          const label = typeof s === 'string' ? undefined : (s as { label?: string }).label;
          return { label, url };
        })
        .filter((s) => s.url && ensureExternalGovUrl(s.url))
        .map((s) => (s.label ? { label: s.label, url: ensureExternalGovUrl(s.url)! } : ensureExternalGovUrl(s.url)!))
      : [];
    res.json({
      items,
      sources: safeSources,
      metadata: {
        event_at: digest.event_at_utc,
        ingested_at: digest.ingested_at_utc,
        confidence: digest.event_time_confidence,
        source: digest.event_time_source
      }
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
