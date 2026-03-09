/**
 * Montgomery road geometries from OpenStreetMap (Overpass API).
 * Returns GeoJSON for motorways, trunk, primary highways.
 * Cached in memory for 1 hour.
 */

import express from 'express';
import path from 'path';
import fs from 'fs';

const router = express.Router();

const MONTGOMERY_BBOX = '32.25,-86.45,32.45,-86.10'; // south,west,north,east
const OVERPASS_URL = `https://overpass-api.de/api/interpreter`;
const CACHE_PATH = path.join(process.cwd(), 'data', 'cache', 'montgomery_roads.json');
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

let cached: { geoJson: object; fetchedAt: number } | null = null;

function osmWayToGeoJSONFeature(elt: {
  geometry?: Array<{ lat: number; lon: number }>;
  tags?: { ref?: string; name?: string; highway?: string };
}): GeoJSON.Feature<GeoJSON.LineString> | null {
  const geom = elt.geometry;
  if (!geom || geom.length < 2) return null;
  const coords = geom.map((p) => [p.lon, p.lat] as [number, number]);
  const ref = elt.tags?.ref?.split(';')[0]?.trim() || elt.tags?.name || '';
  return {
    type: 'Feature',
    properties: { ref, highway: elt.tags?.highway },
    geometry: { type: 'LineString', coordinates: coords },
  };
}

async function fetchRoadsFromOverpass(): Promise<GeoJSON.FeatureCollection<GeoJSON.LineString>> {
  const query = `
[out:json][timeout:25];
(
  way["highway"="motorway"](${MONTGOMERY_BBOX});
  way["highway"="trunk"](${MONTGOMERY_BBOX});
  way["highway"="primary"](${MONTGOMERY_BBOX});
);
out geom;
  `.trim();

  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });
  const data = await res.json();
  const features = (data.elements || [])
    .filter((e: { type?: string; geometry?: unknown[] }) => e.type === 'way' && e.geometry?.length)
    .map(osmWayToGeoJSONFeature)
    .filter(Boolean) as GeoJSON.Feature<GeoJSON.LineString>[];

  return { type: 'FeatureCollection', features };
}

async function getRoadsGeoJSON(): Promise<GeoJSON.FeatureCollection<GeoJSON.LineString>> {
  const now = Date.now();
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.geoJson as GeoJSON.FeatureCollection<GeoJSON.LineString>;
  }
  const cacheDir = path.dirname(CACHE_PATH);
  if (fs.existsSync(CACHE_PATH)) {
    const stat = fs.statSync(CACHE_PATH);
    if (now - stat.mtimeMs < CACHE_TTL_MS) {
      const data = JSON.parse(fs.readFileSync(CACHE_PATH, 'utf8'));
      cached = { geoJson: data, fetchedAt: stat.mtimeMs };
      return data;
    }
  }
  const geoJson = await fetchRoadsFromOverpass();
  cached = { geoJson, fetchedAt: now };
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(CACHE_PATH, JSON.stringify(geoJson));
  return geoJson;
}

router.get('/roads/geojson', async (_req, res) => {
  try {
    const geoJson = await getRoadsGeoJSON();
    res.json(geoJson);
  } catch (err) {
    console.error('[Roads API]', err);
    res.status(500).json({ error: 'Failed to fetch road geometries' });
  }
});

export default router;
