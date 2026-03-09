import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pointInPolygon } from './geoUtils';

type DistrictFeature = {
  properties?: { name?: string };
  geometry?: { coordinates?: unknown[] };
};

export type SignalLocationRow = {
  category: string | null;
  neighborhood: string | null;
  lat: number | null;
  lng: number | null;
  raw_json: string | null;
};

export type HydratedSignalLocation = {
  category: string;
  neighborhood: string | null;
  district: string | null;
  location_text: string | null;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CATEGORY_VARIANTS: Record<string, string> = {
  traffic: 'Traffic',
  parks: 'Parks',
  civic: 'Civic',
  infrastructure: 'Infrastructure',
  sanitation: 'Sanitation',
  planning: 'Planning',
  'public safety': 'Public Safety',
  'public-safety': 'Public Safety',
  publicsafety: 'Public Safety',
};

const NEIGHBORHOOD_PATTERNS = [
  { label: 'West Montgomery', patterns: [/\bwest montgomery\b/i] },
  { label: 'Downtown', patterns: [/\bdowntown\b/i] },
  { label: 'EastChase', patterns: [/\beast[\s-]?chase\b/i] },
];

let districtFeaturesCache: DistrictFeature[] | null = null;

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

export function normalizeSignalCategory(value: unknown): string {
  const trimmed = normalizeText(value);
  if (!trimmed) return 'Uncategorized';
  const normalizedKey = trimmed.toLowerCase().replace(/[\s_-]+/g, ' ').trim();
  return CATEGORY_VARIANTS[normalizedKey] ?? trimmed;
}

export function normalizeDistrictLabel(value: unknown): string | null {
  const trimmed = normalizeText(value);
  if (!trimmed) return null;
  const match = trimmed.match(/([1-9])/);
  return match ? `District ${match[1]}` : trimmed;
}

export function normalizeNeighborhoodLabel(value: unknown): string | null {
  const trimmed = normalizeText(value);
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  for (const entry of NEIGHBORHOOD_PATTERNS) {
    if (entry.label.toLowerCase() === lower || entry.patterns.some((pattern) => pattern.test(trimmed))) {
      return entry.label;
    }
  }
  return trimmed;
}

function loadDistrictFeatures(): DistrictFeature[] {
  if (districtFeaturesCache) return districtFeaturesCache;
  try {
    const geoPath = path.join(__dirname, '../../src/data/montgomery_districts.json');
    const raw = fs.readFileSync(geoPath, 'utf-8');
    const geo = JSON.parse(raw) as { features?: DistrictFeature[] };
    districtFeaturesCache = geo.features ?? [];
  } catch {
    districtFeaturesCache = [];
  }
  return districtFeaturesCache;
}

function parseRawJson(rawJson: string | null): Record<string, unknown> | null {
  if (!rawJson) return null;
  try {
    const parsed = JSON.parse(rawJson);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function readString(container: unknown, key: string): string | null {
  if (!container || typeof container !== 'object') return null;
  const value = (container as Record<string, unknown>)[key];
  if (typeof value === 'number') return String(value);
  return normalizeText(value) || null;
}

function getRawField(raw: Record<string, unknown> | null, keys: string[]): string | null {
  const containers = [raw, raw?.attributes, raw?.properties];
  for (const container of containers) {
    for (const key of keys) {
      const value = readString(container, key);
      if (value) return value;
    }
  }
  return null;
}

function joinLocationParts(parts: Array<string | null>): string | null {
  const seen = new Set<string>();
  const values = parts.filter((part): part is string => Boolean(part)).filter((part) => {
    const key = part.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return values.length ? values.join(' · ') : null;
}

export function getDistrictForCoords(lat: number, lng: number): string | null {
  for (const feature of loadDistrictFeatures()) {
    const ring = (feature.geometry?.coordinates?.[0] ?? []) as [number, number][];
    if (ring.length < 3) continue;
    if (pointInPolygon([lat, lng], ring)) {
      return feature.properties?.name ?? null;
    }
  }
  return null;
}

export function hydrateSignalLocation(row: SignalLocationRow): HydratedSignalLocation {
  const raw = parseRawJson(row.raw_json);
  const category = normalizeSignalCategory(
    row.category ?? getRawField(raw, ['category', 'CATEGORY', 'type', 'TYPE'])
  );
  const neighborhood =
    normalizeNeighborhoodLabel(getRawField(raw, ['neighborhood', 'NEIGHBORHOOD', 'community', 'COMMUNITY'])) ??
    normalizeNeighborhoodLabel(row.neighborhood);
  const district =
    normalizeDistrictLabel(getRawField(raw, ['district', 'DISTRICT', 'ward', 'WARD'])) ??
    (row.lat != null && row.lng != null ? getDistrictForCoords(row.lat, row.lng) : null);
  const locationText = joinLocationParts([
    normalizeText(getRawField(raw, ['location', 'LOCATION', 'address', 'ADDRESS', 'street', 'STREET', 'block', 'BLOCK'])) || null,
    neighborhood,
    district,
  ]);

  return {
    category,
    neighborhood,
    district,
    location_text: locationText,
  };
}

export function hydrateSignal<T extends SignalLocationRow>(row: T): T & HydratedSignalLocation {
  return {
    ...row,
    ...hydrateSignalLocation(row),
  };
}

export function hydrateSignals<T extends SignalLocationRow>(rows: T[]): Array<T & HydratedSignalLocation> {
  return rows.map((row) => hydrateSignal(row));
}

export function countSignalsByDistrict<T extends SignalLocationRow>(rows: T[]): Array<{ district: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const district = hydrateSignalLocation(row).district;
    if (!district) continue;
    counts.set(district, (counts.get(district) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([district, count]) => ({ district, count }))
    .sort((a, b) => b.count - a.count || a.district.localeCompare(b.district));
}