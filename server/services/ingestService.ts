import { resolveHubItem } from '../connectors/arcgis/hubItemResolver';
import { queryArcGISLayer } from '../connectors/arcgis/arcgisClient';
import { normalizeArcGISFeature } from '../connectors/arcgis/normalizeSignals';
import { parseEventTimeFromOpenData } from '../time/parseEventTime';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const dbPath = process.env.SQLITE_PATH || './data/cache.sqlite';
const db = new Database(dbPath);

const hubItems = [
  "https://opendata.montgomeryal.gov/apps/e5004d18034e41e192e89e03601d4c17",
  "https://opendata.montgomeryal.gov/apps/0dcb0a26743442168f36c38e3e020300",
  "https://opendata.montgomeryal.gov/maps/3b6888b911174bd28c746c737b4006ac",
  "https://opendata.montgomeryal.gov/maps/ebd5bd8832b04ce8b87a5accfc3b1526",
  "https://opendata.montgomeryal.gov/apps/989599339fed43138248fb799625ad8c",
  "https://opendata.montgomeryal.gov/maps/1dce55228002411ba308638a11bdb813",
  "https://opendata.montgomeryal.gov/documents/c0c056626bd449cba2c078f5c49c2650"
];

const OPEN_DATA_FIELD_PRIORITY = [
  "created_date",
  "createdDate",
  "request_date",
  "requestDate",
  "opened_date",
  "openedDate",
  "date",
  "datetime",
  "timestamp",
  "published_date",
  "publication_date",
  "closed_date"
];

export async function refreshSignals() {
  console.log("Starting signal refresh...");
  const now = new Date().toISOString();

  for (const hubUrl of hubItems) {
    const item = await resolveHubItem(hubUrl);
    if (!item) continue;

    // Create snapshot
    const snapshotId = crypto.randomUUID();
    db.prepare(`
      INSERT INTO snapshots (id, snapshot_at_utc, source, created_at_utc)
      VALUES (?, ?, ?, ?)
    `).run(snapshotId, now, item.id, now);

    // Update source table
    db.prepare(`
      INSERT OR REPLACE INTO sources (id, label, type, url, status)
      VALUES (?, ?, ?, ?, 'refreshing')
    `).run(item.id, item.title, item.type, item.url);

    try {
      // Query layer (assuming layer 0 for now)
      const features = await queryArcGISLayer(`${item.url}/0`);
      console.log(`Fetched ${features.length} features for ${item.title}`);

      // Normalize and store
      const insertSignal = db.prepare(`
        INSERT OR REPLACE INTO signals (
          id, snapshot_id, event_at_utc, ingested_at_utc, event_time_confidence, event_time_source,
          category, neighborhood, lat, lng, raw_json, created_at_utc
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const transaction = db.transaction((features) => {
        for (const feature of features) {
          const attr = feature.attributes;
          const timeResult = parseEventTimeFromOpenData(attr, OPEN_DATA_FIELD_PRIORITY);
          const normalized = normalizeArcGISFeature(feature, item.id);
          
          // Stable hash for ID
          const stableId = crypto.createHash('md5')
            .update(`${item.id}_${normalized.id}_${timeResult.eventAtUtc}`)
            .digest('hex');

          insertSignal.run(
            stableId,
            snapshotId,
            timeResult.eventAtUtc,
            timeResult.ingestedAtUtc,
            timeResult.confidence,
            timeResult.source,
            normalized.category,
            normalized.neighborhood,
            normalized.lat,
            normalized.lng,
            normalized.raw_json,
            now
          );
        }
      });

      transaction(features);

      // Update source status
      db.prepare(`
        UPDATE sources 
        SET last_run = ?, record_count = ?, status = 'idle'
        WHERE id = ?
      `).run(now, features.length, item.id);

    } catch (error) {
      console.error(`Error refreshing ${item.title}:`, error);
      db.prepare(`UPDATE sources SET status = 'error' WHERE id = ?`).run(item.id);
    }
  }

  console.log("Signal refresh complete.");
}

async function generateGeoJSON(sourceId: string, features: any[]) {
  const geojson = {
    type: "FeatureCollection",
    features: features.map(f => ({
      type: "Feature",
      geometry: esriToGeojson(f.geometry),
      properties: f.attributes
    }))
  };

  const dir = path.join(process.cwd(), 'data', 'geojson');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(
    path.join(dir, `${sourceId}.geojson`),
    JSON.stringify(geojson, null, 2)
  );
}

import { esriToGeojson } from '../connectors/arcgis/esriToGeojson';
