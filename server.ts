import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import helmet from "helmet";
import { GoogleGenAI } from "@google/genai";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Routes
import sourcesRoutes from "./server/routes/sourcesRoutes";
import refreshRoutes from "./server/routes/refreshRoutes";
import geojsonRoutes from "./server/routes/geojsonRoutes";
import historicalRoutes from "./server/routes/historicalRoutes";

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
  const app = express();
  const PORT = 3000;

  app.use(helmet({
    contentSecurityPolicy: false, // Disable for development with Vite
  }));
  app.use(cors());
  app.use(express.json());

  // ArcGIS Ingestion Routes
  app.use("/api", sourcesRoutes);
  app.use("/api", refreshRoutes);
  app.use("/api", geojsonRoutes);
  app.use("/api", historicalRoutes);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  // Mock data generator for Montgomery 311
  const generateMockSignals = () => {
    const categories = ["Infrastructure", "Sanitation", "Public Safety", "Parks", "Traffic"];
    const neighborhoods = ["West Montgomery", "Downtown", "EastChase", "Garden District", "Cloverdale"];
    const signals = [];
    const now = new Date();
    const snapshotId = "mock-snapshot-123";

    // Ensure snapshot exists
    db.prepare(`
      INSERT OR IGNORE INTO snapshots (id, snapshot_at_utc, source, created_at_utc)
      VALUES (?, ?, ?, ?)
    `).run(snapshotId, now.toISOString(), "mock_311", now.toISOString());

    for (let i = 0; i < 100; i++) {
      const eventAt = new Date(now.getTime() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString();
      signals.push({
        id: `311-${Math.random().toString(36).substr(2, 9)}`,
        snapshot_id: snapshotId,
        event_at_utc: eventAt,
        ingested_at_utc: now.toISOString(),
        event_time_confidence: "HIGH",
        event_time_source: "mock_generator",
        category: categories[Math.floor(Math.random() * categories.length)],
        neighborhood: neighborhoods[Math.floor(Math.random() * neighborhoods.length)],
        lat: 32.3668 + (Math.random() - 0.5) * 0.1,
        lng: -86.3000 + (Math.random() - 0.5) * 0.1,
        raw_json: JSON.stringify({ mock: true }),
        created_at_utc: now.toISOString()
      });
    }
    return signals;
  };

  const refreshData = async () => {
    console.log("Background Worker: Refreshing civic data...");
    
    // 1. Refresh AI Summary
    const signals = db.prepare("SELECT * FROM signals ORDER BY event_at_utc DESC LIMIT 20").all();
    if (signals.length > 0) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Summarize these civic signals for a "City Snapshot" dashboard. Data: ${JSON.stringify(signals)}`,
        });
        // Store summary in a simple cache table or memory
        app.set('ai_summary', response.text);
      } catch (e) {
        console.error("AI Refresh failed");
      }
    }
  };

  // Start Background Worker (Run every hour)
  setInterval(refreshData, 3600000);
  // Initial run
  refreshData();

  // API Routes
  app.get("/api/signals/latest", (req, res) => {
    const signals = db.prepare("SELECT * FROM signals ORDER BY event_at_utc DESC LIMIT 100").all();
    // If empty, seed with mock data for demo
    if (signals.length === 0) {
      const mock = generateMockSignals();
      const insert = db.prepare(`
        INSERT INTO signals (
          id, snapshot_id, event_at_utc, ingested_at_utc, event_time_confidence, event_time_source,
          category, neighborhood, lat, lng, raw_json, created_at_utc
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const insertMany = db.transaction((data) => {
        for (const s of data) insert.run(
          s.id, s.snapshot_id, s.event_at_utc, s.ingested_at_utc, s.event_time_confidence, s.event_time_source,
          s.category, s.neighborhood, s.lat, s.lng, s.raw_json, s.created_at_utc
        );
      });
      insertMany(mock);
      return res.json(mock);
    }
    res.json(signals);
  });

  app.get("/api/digest/today", async (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    const digest = db.prepare("SELECT * FROM digests WHERE date_key = ?").get(today);
    
    if (!digest) {
        // Seed mock digest for today
        const now = new Date().toISOString();
        const mockItems = [
            { title: "City Council Meeting", content: "Discussion on new park development in West Montgomery.", source: "City Clerk", url: "#" },
            { title: "Road Closure: Madison Ave", content: "Madison Ave will be closed for utility repairs starting Monday.", source: "Dept of Engineering", url: "#" },
            { title: "Zoning Hearing", content: "Public hearing for proposed residential complex on Perry St.", source: "Planning Dept", url: "#" }
        ];
        
        const digestId = crypto.randomUUID();
        db.prepare(`
          INSERT INTO digests (
            id, date_key, event_at_utc, ingested_at_utc, event_time_confidence, event_time_source,
            items_json, sources_json, created_at_utc
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          digestId, today, now, now, "HIGH", "mock_generator",
          JSON.stringify(mockItems), JSON.stringify([{ label: "City Announcements", url: "https://www.montgomeryal.gov" }]),
          now
        );
        
        return res.json({ items: mockItems });
    }
    
    res.json({
      items: JSON.parse(digest.items_json),
      sources: JSON.parse(digest.sources_json),
      metadata: {
        event_at: digest.event_at_utc,
        confidence: digest.event_time_confidence,
        source: digest.event_time_source
      }
    });
  });

  app.post("/api/ai/summarize", async (req, res) => {
    const cachedSummary = app.get('ai_summary');
    if (cachedSummary) {
      return res.json({ summary: cachedSummary });
    }
    
    const { data } = req.body;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Summarize these civic signals for a "City Snapshot" dashboard. Focus on trends and high-demand areas. Data: ${JSON.stringify(data)}`,
        config: {
            systemInstruction: "You are a civic data analyst for the city of Montgomery. Provide concise, professional insights."
        }
      });
      res.json({ summary: response.text });
    } catch (error) {
      res.status(500).json({ error: "AI summarization failed" });
    }
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
