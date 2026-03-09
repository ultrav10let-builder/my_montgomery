/**
 * District & neighborhood breakdown from signals.
 * Precise parsing: uses signal.category and signal.neighborhood from source data.
 * District assigned via point-in-polygon; neighborhood from signal record.
 */

import type { CivicSignal } from '../types';
import { pointInPolygon } from './geoUtils';
import districtGeo from '../data/montgomery_districts.json';

export interface CategoryCount {
  category: string;
  count: number;
}

export interface NeighborhoodBreakdown {
  neighborhood: string;
  total: number;
  byCategory: CategoryCount[];
}

export interface DistrictBreakdown {
  district: string;
  districtNumber: number;
  total: number;
  byCategory: CategoryCount[];
  neighborhoods: NeighborhoodBreakdown[];
}

const DISTRICT_FEATURES = (
  districtGeo as {
    features?: Array<{
      properties?: { name?: string; district?: number };
      geometry?: { coordinates?: unknown[] };
    }>;
  }
).features ?? [];

/** Normalize category for grouping – trim, preserve original for display. */
function normalizeCategory(cat: string | null | undefined): string {
  const c = (cat ?? '').trim();
  return c || 'Uncategorized';
}

/** Normalize neighborhood for grouping. */
function normalizeNeighborhood(n: string | null | undefined): string {
  const s = (n ?? '').trim();
  return s || 'Unspecified';
}

function normalizeDistrictLabel(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return null;
  const match = trimmed.match(/([1-9])/);
  return match ? `District ${match[1]}` : trimmed;
}

/**
 * Assign point to district by point-in-polygon. Returns district name or null if outside all.
 * Coords: lat, lng (Leaflet convention).
 */
export function getDistrictForCoords(lat: number, lng: number): string | null {
  for (const f of DISTRICT_FEATURES) {
    const ring = (f.geometry?.coordinates?.[0] ?? []) as [number, number][];
    if (ring.length < 3) continue;
    if (pointInPolygon([lat, lng], ring)) {
      return f.properties?.name ?? null;
    }
  }
  return null;
}

/**
 * Assign signal to district by normalized field first, then point-in-polygon fallback.
 */
export function getDistrictForSignal(signal: CivicSignal): string | null {
  const explicitDistrict = normalizeDistrictLabel(signal.district);
  if (explicitDistrict) return explicitDistrict;
  if (signal.lat == null || signal.lng == null) return null;
  return getDistrictForCoords(signal.lat, signal.lng);
}

/**
 * Compute district → neighborhood → category breakdown from signals.
 * Each count is from actual records; no estimation.
 */
export function computeDistrictBreakdown(signals: CivicSignal[]): DistrictBreakdown[] {
  // district -> neighborhood -> category -> count
  const map = new Map<string, Map<string, Map<string, number>>>();

  for (const s of signals) {
    const district = getDistrictForSignal(s);
    if (!district) continue;

    const neighborhood = normalizeNeighborhood(s.neighborhood);
    const category = normalizeCategory(s.category);

    if (!map.has(district)) {
      map.set(district, new Map());
    }
    const distMap = map.get(district)!;
    if (!distMap.has(neighborhood)) {
      distMap.set(neighborhood, new Map());
    }
    const neighMap = distMap.get(neighborhood)!;
    neighMap.set(category, (neighMap.get(category) ?? 0) + 1);
  }

  const result: DistrictBreakdown[] = [];
  const districtOrder = ['District 1', 'District 2', 'District 3', 'District 4', 'District 5', 'District 6', 'District 7', 'District 8', 'District 9'];

  for (const district of districtOrder) {
    const distMap = map.get(district);
    if (!distMap) {
      result.push({
        district,
        districtNumber: parseInt(district.replace(/\D/g, ''), 10) || 0,
        total: 0,
        byCategory: [],
        neighborhoods: [],
      });
      continue;
    }

    const byCategoryMap = new Map<string, number>();
    const neighborhoods: NeighborhoodBreakdown[] = [];

    for (const [neighborhood, catMap] of distMap) {
      let neighTotal = 0;
      const neighCategories: CategoryCount[] = [];
      for (const [cat, count] of catMap) {
        neighTotal += count;
        byCategoryMap.set(cat, (byCategoryMap.get(cat) ?? 0) + count);
        neighCategories.push({ category: cat, count });
      }
      neighCategories.sort((a, b) => b.count - a.count);
      neighborhoods.push({
        neighborhood,
        total: neighTotal,
        byCategory: neighCategories,
      });
    }

    neighborhoods.sort((a, b) => b.total - a.total);

    const byCategory: CategoryCount[] = Array.from(byCategoryMap.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);

    const total = byCategory.reduce((sum, c) => sum + c.count, 0);

    result.push({
      district,
      districtNumber: parseInt(district.replace(/\D/g, ''), 10) || 0,
      total,
      byCategory,
      neighborhoods,
    });
  }

  return result;
}
