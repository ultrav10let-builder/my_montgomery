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

export interface AuditedHistoricalDataset {
  label: string;
  url: string;
  category: string;
  priority: 'high' | 'medium';
  notes: string;
}

/** Montgomery Open Data Hub items – apps, maps, documents. Items without a Feature Service URL are skipped. */
export const OPEN_DATA_HUB_URLS = [
  "https://opendata.montgomeryal.gov/apps/e5004d18034e41e192e89e03601d4c17",
  "https://opendata.montgomeryal.gov/apps/0dcb0a26743442168f36c38e3e020300",
  "https://opendata.montgomeryal.gov/apps/81bb064ad1ab46fa967cd2b1e2de472f",
  "https://opendata.montgomeryal.gov/apps/9795847bdaa241f9b6856e89ed663176",
  "https://opendata.montgomeryal.gov/apps/23e084994f4d48d4ba8e7428d30e1d9d",
  "https://opendata.montgomeryal.gov/apps/7afe1129ef9d40398fb888c769c93b72",
  "https://opendata.montgomeryal.gov/maps/3b6888b911174bd28c746c737b4006ac",
  "https://opendata.montgomeryal.gov/maps/a140321472c746ea865a234085cfbf8e",
  "https://opendata.montgomeryal.gov/apps/ddfebc6549484dadb969c477e46f7448",
  "https://opendata.montgomeryal.gov/apps/55c485f37ada4ff0b7a0da6ab3d473cd",
  "https://opendata.montgomeryal.gov/apps/e464ac3720e942b8b6d1794514066b1f",
  "https://opendata.montgomeryal.gov/maps/ebd5bd8832b04ce8b87a5accfc3b1526",
  "https://opendata.montgomeryal.gov/maps/dda20bc709e6408cbc7c39a083748d3b",
  "https://opendata.montgomeryal.gov/apps/df0e68e8fbd04fdc8be1adc6aa46213b",
  "https://opendata.montgomeryal.gov/apps/f017fc99b20c41a0af6d01fc2d613208",
  "https://opendata.montgomeryal.gov/apps/989599339fed43138248fb799625ad8c",
  "https://opendata.montgomeryal.gov/apps/0a32de348e314c8abf20a4e0f63142d9",
  "https://opendata.montgomeryal.gov/apps/fa25d381ab7246bbb166e0a9f8ad1db2",
  "https://opendata.montgomeryal.gov/maps/f117bc7518814bb9aa7c5669025eecd2",
  "https://opendata.montgomeryal.gov/apps/4333fa48215e46dcb429e3f37119d991",
  "https://opendata.montgomeryal.gov/maps/1dce55228002411ba308638a11bdb813",
  "https://opendata.montgomeryal.gov/apps/480198ffe035473895a7b849fa905c0d",
  "https://opendata.montgomeryal.gov/apps/e2472633667b47b385fe22739b7afe2f",
  "https://opendata.montgomeryal.gov/apps/96a494d436c24a66821dac6792cd12f9",
  "https://opendata.montgomeryal.gov/apps/55b4ca274b5749bab24096afb093a7c1",
  "https://opendata.montgomeryal.gov/apps/9b52741f117e40dea059575190b30b38",
  "https://opendata.montgomeryal.gov/apps/fc5a0ef183ea4d8aa7a09fb859e54240",
  "https://opendata.montgomeryal.gov/apps/f81a2ad43a774ffcb799e73a33537b56",
  "https://opendata.montgomeryal.gov/apps/f95fea6ac3484bd0bc4b21315b384e29",
  "https://opendata.montgomeryal.gov/documents/c0c056626bd449cba2c078f5c49c2650",
  "https://opendata.montgomeryal.gov/apps/d85bf8dbb1e74af0b22dc1b3c22edab0",
  "https://opendata.montgomeryal.gov/apps/4896d35505644a4e9cdbe6978dc41c0f",
  "https://opendata.montgomeryal.gov/apps/6982c816402e405680a8e5d85b6c02d5",
  "https://opendata.montgomeryal.gov/apps/8884d6ccb27e413b870156da0da161f7",
  "https://opendata.montgomeryal.gov/apps/0f58ef5ee5cb469597681bca1c799f2e",
  "https://opendata.montgomeryal.gov/apps/16387658f2d24ad4bfc21002c628450f",
  "https://opendata.montgomeryal.gov/maps/1fc59cd352224e80bab3bf8a99da907c",
  "https://opendata.montgomeryal.gov/maps/a9557ddbe0034478ab5f46fa1ce566b1",
  "https://opendata.montgomeryal.gov/apps/09d20d8ee55e4761a04a6e7f0f0193c7",
  "https://opendata.montgomeryal.gov/maps/d0c6eccf4b7748f19248a0adec2895fd",
  "https://opendata.montgomeryal.gov/maps/46a3ffb5bd244363a6f90bc17a37ea7e",
  "https://opendata.montgomeryal.gov/maps/b7652ce3ea90453cb90b000ddd24f21c",
  "https://opendata.montgomeryal.gov/maps/b533d87ecb9c42e79614e2c43734aabe",
  "https://opendata.montgomeryal.gov/maps/6fea1b94d7c5429092b6453b49c0360e",
  "https://opendata.montgomeryal.gov/maps/9417d27fb9e0442793d0503f9f3e663d",
  "https://opendata.montgomeryal.gov/maps/05f368fbb1da44e7ba878c47ebc72f76",
  "https://opendata.montgomeryal.gov/maps/3a030d87c47d490ca32e72a963a3d0c0",
  "https://opendata.montgomeryal.gov/maps/a1dd63f11f914b92b72eb9095476f9c8",
  "https://opendata.montgomeryal.gov/content/d99a0a44e0e94d54a6a94f97fa363c8f",
  "https://opendata.montgomeryal.gov/maps/3cb0d131f2f54f15b92cda56fc0fde22",
  "https://opendata.montgomeryal.gov/maps/869437149b0a4b93ab2dd0d1465c48d1",
  "https://opendata.montgomeryal.gov/maps/4bbaa32947694179b27c2b05d2d16b75",
  "https://opendata.montgomeryal.gov/maps/d3d91850fa6c4d85a5234b3f72fe2d2b",
  "https://opendata.montgomeryal.gov/maps/d8310b19bdf74ac9bb95326c2958c915",
  "https://opendata.montgomeryal.gov/maps/4c077a7c159a414983b5cd4b99f9f921",
  "https://opendata.montgomeryal.gov/apps/4679ac7a727243afb188857e8de1f04e",
  "https://opendata.montgomeryal.gov/apps/8c2aeb724f0049188127fb4704adfd84",
  "https://opendata.montgomeryal.gov/maps/e58056aeb8354e0d80483dab81ee2899",
  "https://opendata.montgomeryal.gov/maps/151cbba0aa0f475592c95b71bbc422e8",
];

export const HIGH_VALUE_HISTORICAL_DATASETS: AuditedHistoricalDataset[] = [
  {
    label: '311 Service Requests',
    url: 'https://opendata.montgomeryal.gov/apps/e5004d18034e41e192e89e03601d4c17',
    category: 'Infrastructure',
    priority: 'high',
    notes: 'Best broad signal source for recurring neighborhood-level service demand.',
  },
  {
    label: 'Code Violations',
    url: 'https://opendata.montgomeryal.gov/apps/0dcb0a26743442168f36c38e3e020300',
    category: 'Public Safety',
    priority: 'high',
    notes: 'Useful for blight, enforcement, and chronic issue monitoring over time.',
  },
  {
    label: 'Zoning Cases',
    url: 'https://opendata.montgomeryal.gov/maps/3b6888b911174bd28c746c737b4006ac',
    category: 'Planning',
    priority: 'high',
    notes: 'High-value planning and board-facing land-use activity.',
  },
  {
    label: 'Capital Projects',
    url: 'https://opendata.montgomeryal.gov/maps/ebd5bd8832b04ce8b87a5accfc3b1526',
    category: 'Infrastructure',
    priority: 'high',
    notes: 'Supports long-running corridor work, project tracking, and trend context.',
  },
  {
    label: 'Business Licenses',
    url: 'https://opendata.montgomeryal.gov/apps/989599339fed43138248fb799625ad8c',
    category: 'Civic',
    priority: 'medium',
    notes: 'Useful for economic activity context and corridor activation trends.',
  },
  {
    label: 'Parks & Recreation Facilities',
    url: 'https://opendata.montgomeryal.gov/maps/1dce55228002411ba308638a11bdb813',
    category: 'Parks',
    priority: 'medium',
    notes: 'Helps map park assets and public-facility coverage.',
  },
  {
    label: 'City Council Districts',
    url: 'https://opendata.montgomeryal.gov/documents/c0c056626bd449cba2c078f5c49c2650',
    category: 'Civic',
    priority: 'high',
    notes: 'Critical for district overlays and council-facing reporting alignment.',
  },
];

const OPEN_DATA_FIELD_PRIORITY = [
  "created_date",
  "createdDate",
  "CREATED_DATE",
  "request_date",
  "requestDate",
  "REQUEST_DATE",
  "opened_date",
  "openedDate",
  "OPENED_AT",
  "date",
  "DATE",
  "datetime",
  "timestamp",
  "published_date",
  "publication_date",
  "DATE_REPORTED",
  "closed_date",
  "CLOSED_AT",
  "ISSUE_DATE",
];

export async function refreshSignals() {
  console.log("Starting signal refresh...");
  const now = new Date().toISOString();

  for (const hubUrl of OPEN_DATA_HUB_URLS) {
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

      // Remove mock data when real data is available (mock replaced by live city data)
      if (features.length > 0) {
        const deleted = db.prepare(
          "DELETE FROM signals WHERE event_time_source = 'mock_generator' OR snapshot_id = 'mock-snapshot-123'"
        ).run();
        if (deleted.changes > 0) {
          console.log(`Removed ${deleted.changes} mock signals (replaced by live data).`);
        }
      }

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
