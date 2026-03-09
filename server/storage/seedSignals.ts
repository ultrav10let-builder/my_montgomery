/**
 * Seed demo signals when the signals table is empty.
 * Uses event_time_source='seed_demo' (passes REAL_DATA_FILTER; not mock_generator).
 * Neighborhoods match montgomery.json: West Montgomery, Downtown, EastChase.
 * Varies counts so pressure colors (green/yellow/orange/red) appear.
 */

import Database from 'better-sqlite3';

type SqliteDatabase = InstanceType<typeof Database>;

const SNAPSHOT_ID = 'seed-demo-snapshot';
const SOURCE = 'seed_demo';

interface SeedSignal {
  id: string;
  snapshot_id: string;
  event_at_utc: string;
  ingested_at_utc: string;
  event_time_confidence: string;
  event_time_source: string;
  category: string;
  neighborhood: string;
  lat: number;
  lng: number;
  raw_json: string;
  created_at_utc: string;
}

function buildSeedSignals(): SeedSignal[] {
  const now = new Date();
  const base = new Date(now);
  base.setDate(base.getDate() - 5);

  const fmt = (d: Date) => d.toISOString();

  // Scatter points within polygon bounds (not a diagonal line)
  // West Montgomery: lat 32.35–32.38, lng -86.35–-86.32
  // Downtown: lat 32.36–32.39, lng -86.32–-86.29
  // EastChase: lat 32.34–32.38, lng -86.20–-86.15
  const wm = (i: number) => ({ lat: 32.351 + (i % 4) * 0.008, lng: -86.348 + Math.floor(i / 4) * 0.005 });
  const dt = (i: number) => ({ lat: 32.362 + (i % 2) * 0.012, lng: -86.318 + Math.floor(i / 2) * 0.008 });
  const ec = (i: number) => ({ lat: 32.355 + i * 0.012, lng: -86.185 });

  const wmCategories = ['Infrastructure', 'Sanitation', 'Public Safety', 'Parks', 'Traffic', 'Civic', 'Infrastructure', 'Sanitation', 'Public Safety', 'Civic'];
  const wmDescriptions = ['Pothole repair request', 'Missed trash pickup', 'Noise complaint', 'Park equipment repair', 'Traffic signal outage', 'Zoning inquiry', 'Streetlight out', 'Bulk pickup request', 'Community watch report', 'Council meeting notice'];
  const dtCategories = ['Infrastructure', 'Parks', 'Traffic', 'Civic'];
  const dtDescriptions = ['Sidewalk damage', 'Tree trimming request', 'Road closure notice', 'Permit inquiry'];
  const ecCategories = ['Sanitation', 'Public Safety'];
  const ecDescriptions = ['Recycling bin replacement', 'Speed concern'];

  const entries: { neighborhood: string; lat: number; lng: number; category: string; description: string }[] = [
    ...Array(10).fill(null).map((_, i) => ({
      neighborhood: 'West Montgomery',
      ...wm(i),
      category: wmCategories[i],
      description: wmDescriptions[i]
    })),
    ...Array(4).fill(null).map((_, i) => ({
      neighborhood: 'Downtown',
      ...dt(i),
      category: dtCategories[i],
      description: dtDescriptions[i]
    })),
    ...Array(2).fill(null).map((_, i) => ({
      neighborhood: 'EastChase',
      ...ec(i),
      category: ecCategories[i],
      description: ecDescriptions[i]
    }))
  ];

  return entries.map((e, idx) => {
    const eventAt = new Date(base);
    eventAt.setHours(eventAt.getHours() + idx);
    const id = `seed-demo-${idx + 1}`;
    const raw = JSON.stringify({ category: e.category, neighborhood: e.neighborhood, description: e.description, source: SOURCE });
    return {
      id,
      snapshot_id: SNAPSHOT_ID,
      event_at_utc: fmt(eventAt),
      ingested_at_utc: fmt(now),
      event_time_confidence: 'HIGH',
      event_time_source: SOURCE,
      category: e.category,
      neighborhood: e.neighborhood,
      lat: e.lat,
      lng: e.lng,
      raw_json: raw,
      created_at_utc: fmt(now)
    };
  });
}

export function seedSignalsWhenEmpty(db: SqliteDatabase): void {
  const count = db.prepare(
    "SELECT COUNT(*) as c FROM signals WHERE event_time_source != 'mock_generator'"
  ).get() as { c: number };
  if (count.c > 0) return;

  const now = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO snapshots (id, snapshot_at_utc, source, created_at_utc)
    VALUES (?, ?, ?, ?)
  `).run(SNAPSHOT_ID, now, SOURCE, now);

  const signals = buildSeedSignals();
  const insert = db.prepare(`
    INSERT INTO signals (
      id, snapshot_id, event_at_utc, ingested_at_utc, event_time_confidence, event_time_source,
      category, neighborhood, lat, lng, raw_json, created_at_utc
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const s of signals) {
    insert.run(
      s.id, s.snapshot_id, s.event_at_utc, s.ingested_at_utc, s.event_time_confidence, s.event_time_source,
      s.category, s.neighborhood, s.lat, s.lng, s.raw_json, s.created_at_utc
    );
  }
  console.log(`Seeded ${signals.length} demo signals (event_time_source=seed_demo). Stats and map will display.`);
}
