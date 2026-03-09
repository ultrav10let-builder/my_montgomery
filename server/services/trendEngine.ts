/**
 * Trend Engine – Deterministic analytics from city signal data.
 * AI should consume these aggregates, never raw data.
 * All functions query SQLite and return structured summaries.
 * Supports optional district filter (point-in-polygon on lat/lng).
 */

import * as path from 'path';
import * as fs from 'fs';
import { subDays } from 'date-fns';
import db from '../storage/db';
import { pointInPolygon } from '../utils/geoUtils';
import { countSignalsByDistrict } from '../utils/signalHydration';

const MONTGOMERY_POPULATION = 195818;

/** Pressure score 0–100 from signal count vs city baseline. */
function signalCountToPressureScore(count: number, cityTotal: number, cityAreas: number): number {
  if (cityTotal === 0) return 0;
  const avgPerArea = cityTotal / Math.max(cityAreas, 1);
  if (avgPerArea === 0) return 0;
  const ratio = count / avgPerArea;
  return Math.min(100, Math.round(ratio * 50));
}
const REAL_DATA_FILTER = " AND event_time_source != 'mock_generator'";

type Window = '7d' | '30d' | '90d';

export type WindowOrRange = Window | { start: string; end: string };

/** Normalize district param: "3" -> "District 3". */
export function normalizeDistrictParam(district: string): string {
  const trimmed = district.trim();
  const n = trimmed.replace(/\D/g, '');
  const num = parseInt(n, 10);
  if (num >= 1 && num <= 9) return `District ${num}`;
  const districtMatch = /^District\s*([1-9])$/i.exec(trimmed);
  if (districtMatch) return `District ${districtMatch[1]}`;
  return '';
}

type SignalRow = { lat: number | null; lng: number | null; category: string | null; neighborhood: string | null; raw_json: string | null; event_at_utc: string };

/** Load district polygon ring [lng, lat][] for a district name. */
function getDistrictPolygon(districtName: string): [number, number][] | null {
  try {
    const geoPath = path.join(__dirname, '../../src/data/montgomery_districts.json');
    const raw = fs.readFileSync(geoPath, 'utf-8');
    const geo = JSON.parse(raw) as { features?: Array<{ properties?: { name?: string }; geometry?: { coordinates?: unknown[] } }> };
    const feat = geo.features?.find((f) => f.properties?.name === districtName);
    const coords = feat?.geometry?.coordinates?.[0];
    if (!Array.isArray(coords) || coords.length < 3) return null;
    return coords as [number, number][];
  } catch {
    return null;
  }
}

/** Fetch signals in window that fall within the given district polygon. */
function getSignalsInDistrict(spec: WindowOrRange, districtName: string): SignalRow[] {
  const ring = getDistrictPolygon(districtName);
  if (!ring) return [];
  const { start, end } = getDateRange(spec);
  const baseFilter = `event_at_utc >= ? AND event_at_utc <= ? ${REAL_DATA_FILTER} AND lat IS NOT NULL AND lng IS NOT NULL`;
  const rows = db.prepare(`
    SELECT lat, lng, category, neighborhood, raw_json, event_at_utc FROM signals
    WHERE ${baseFilter}
  `).all(start, end) as SignalRow[];
  return rows.filter((r) => {
    const lat = r.lat ?? 0;
    const lng = r.lng ?? 0;
    return pointInPolygon([lat, lng], ring);
  });
}

function parseWindow(window: Window): number {
  return window === '90d' ? 90 : window === '30d' ? 30 : 7;
}

function getDateRangeFromWindow(window: Window): { start: string; end: string; prevStart: string; prevEnd: string } {
  const days = parseWindow(window);
  const now = new Date();
  const end = now.toISOString();
  const start = subDays(now, days).toISOString();
  const prevEnd = start;
  const prevStart = subDays(new Date(start), days).toISOString();
  return { start, end, prevStart, prevEnd };
}

function getDateRangeFromRange(range: { start: string; end: string }): { start: string; end: string; prevStart: string; prevEnd: string } {
  const startDate = new Date(range.start + 'T00:00:00.000Z');
  const endDate = new Date(range.end + 'T23:59:59.999Z');
  const end = endDate.toISOString();
  const start = startDate.toISOString();
  const days = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000)));
  const prevEnd = start;
  const prevStart = subDays(startDate, days).toISOString();
  return { start, end, prevStart, prevEnd };
}

function getDateRange(spec: WindowOrRange): { start: string; end: string; prevStart: string; prevEnd: string } {
  if (typeof spec === 'object' && 'start' in spec && 'end' in spec) {
    return getDateRangeFromRange(spec);
  }
  return getDateRangeFromWindow(spec as Window);
}

/** Cache key for insights: window string or custom:start:end */
export function getInsightCacheLabel(spec: WindowOrRange): string {
  if (typeof spec === 'object' && 'start' in spec && 'end' in spec) {
    return `custom:${spec.start.slice(0, 10)}:${spec.end.slice(0, 10)}`;
  }
  return spec as string;
}

/** City-wide totals and per-capita for the window. */
export function getCityMetrics(spec: WindowOrRange): {
  totalSignals: number;
  signalsPer10k: number;
  window: string;
} {
  const { start, end } = getDateRange(spec);
  const baseFilter = `event_at_utc >= ? AND event_at_utc <= ? ${REAL_DATA_FILTER}`;
  const row = db.prepare(
    `SELECT COUNT(*) as count FROM signals WHERE ${baseFilter}`
  ).get(start, end) as { count: number };
  const totalSignals = row.count;
  const signalsPer10k = totalSignals > 0
    ? Math.round((totalSignals / MONTGOMERY_POPULATION) * 10000 * 10) / 10
    : 0;
  return { totalSignals, signalsPer10k, window: getInsightCacheLabel(spec) };
}

/** Top categories with count and delta vs prior window. */
export function getTopCategories(spec: WindowOrRange): Array<{
  category: string;
  count: number;
  delta: number;
}> {
  const { start, end, prevStart, prevEnd } = getDateRange(spec);
  const baseFilter = `event_at_utc >= ? AND event_at_utc <= ? ${REAL_DATA_FILTER}`;
  const current = db.prepare(`
    SELECT category, COUNT(*) as count FROM signals
    WHERE ${baseFilter} AND category IS NOT NULL AND category != ''
    GROUP BY category ORDER BY count DESC LIMIT 10
  `).all(start, end) as { category: string; count: number }[];
  const previous = db.prepare(`
    SELECT category, COUNT(*) as count FROM signals
    WHERE ${baseFilter} AND category IS NOT NULL AND category != ''
    GROUP BY category
  `).all(prevStart, prevEnd) as { category: string; count: number }[];
  const prevMap = new Map(previous.map((p) => [p.category, p.count]));
  return current.map((c) => {
    const prevCount = prevMap.get(c.category) ?? 0;
    return {
      category: c.category,
      count: c.count,
      delta: c.count - prevCount,
    };
  });
}

/** District pressure derived from explicit district labels, with polygon fallback for coords. */
export function getDistrictPressure(spec: WindowOrRange): Array<{
  district: string;
  count: number;
  status: string;
}> {
  const { start, end } = getDateRange(spec);
  const baseFilter = `event_at_utc >= ? AND event_at_utc <= ? ${REAL_DATA_FILTER}`;
  const totalRow = db.prepare(
    `SELECT COUNT(*) as count FROM signals WHERE ${baseFilter}`
  ).get(start, end) as { count: number };
  const cityTotal = totalRow.count;
  const signals = db.prepare(`
    SELECT category, neighborhood, lat, lng, raw_json FROM signals
    WHERE ${baseFilter}
  `).all(start, end) as Array<{
    category: string | null;
    neighborhood: string | null;
    lat: number | null;
    lng: number | null;
    raw_json: string | null;
  }>;
  const districts = countSignalsByDistrict(signals);
  const numAreas = Math.max(districts.length, 1);
  return districts.map((d) => {
    const score = signalCountToPressureScore(d.count, cityTotal, numAreas);
    let status: string;
    if (score <= 25) status = 'Good';
    else if (score <= 50) status = 'Normal';
    else if (score <= 75) status = 'Elevated';
    else status = 'High priority';
    return {
      district: d.district,
      count: d.count,
      status,
    };
  });
}

/** Category and district changes vs prior window. */
export function getTrendChanges(spec: WindowOrRange): {
  categories: Array<{ category: string; current: number; previous: number; delta: number }>;
  districts: Array<{ district: string; current: number; previous: number; delta: number }>;
} {
  const { start, end, prevStart, prevEnd } = getDateRange(spec);
  const baseFilter = `event_at_utc >= ? AND event_at_utc <= ? ${REAL_DATA_FILTER}`;
  const currCategories = db.prepare(`
    SELECT category, COUNT(*) as count FROM signals
    WHERE ${baseFilter} AND category IS NOT NULL
    GROUP BY category
  `).all(start, end) as { category: string; count: number }[];
  const prevCategories = db.prepare(`
    SELECT category, COUNT(*) as count FROM signals
    WHERE ${baseFilter} AND category IS NOT NULL
    GROUP BY category
  `).all(prevStart, prevEnd) as { category: string; count: number }[];
  const prevCatMap = new Map(prevCategories.map((p) => [p.category, p.count]));
  const currDistricts = db.prepare(`
    SELECT neighborhood as district, COUNT(*) as count FROM signals
    WHERE ${baseFilter} AND neighborhood IS NOT NULL
    GROUP BY neighborhood
  `).all(start, end) as { district: string; count: number }[];
  const prevDistricts = db.prepare(`
    SELECT neighborhood as district, COUNT(*) as count FROM signals
    WHERE ${baseFilter} AND neighborhood IS NOT NULL
    GROUP BY neighborhood
  `).all(prevStart, prevEnd) as { district: string; count: number }[];
  const prevDistMap = new Map(prevDistricts.map((p) => [p.district, p.count]));
  const categories = currCategories.map((c) => ({
    category: c.category,
    current: c.count,
    previous: prevCatMap.get(c.category) ?? 0,
    delta: c.count - (prevCatMap.get(c.category) ?? 0),
  }));
  const districts = currDistricts.map((d) => ({
    district: d.district,
    current: d.count,
    previous: prevDistMap.get(d.district) ?? 0,
    delta: d.count - (prevDistMap.get(d.district) ?? 0),
  }));
  return { categories, districts };
}

/** BrightData events: traffic feeds + digest items for the window. Used to connect events with signal patterns. */
export function getBrightDataEvents(spec: WindowOrRange): {
  traffic: Array<{ road?: string; description: string; severity?: string }>;
  digest: Array<{ title: string; summary?: string; category?: string }>;
} {
  const { start, end } = getDateRange(spec);
  const trafficRows = db.prepare(`
    SELECT road, description, severity FROM traffic_feeds
    WHERE ingested_at_utc >= ? AND ingested_at_utc <= ?
    ORDER BY ingested_at_utc DESC LIMIT 20
  `).all(start, end) as { road: string | null; description: string; severity: string | null }[];
  const digestRows = db.prepare(`
    SELECT items_json FROM digests
    WHERE date_key >= ? AND date_key <= ?
    ORDER BY date_key DESC LIMIT 10
  `).all(start.slice(0, 10), end.slice(0, 10)) as { items_json: string }[];
  const traffic = trafficRows.map((r) => ({
    road: r.road || undefined,
    description: (r.description || '').trim().slice(0, 150),
    severity: r.severity || undefined,
  }));
  const digest: Array<{ title: string; summary?: string; category?: string }> = [];
  for (const row of digestRows) {
    try {
      const items = JSON.parse(row.items_json || '[]') as Array<{ title?: string; summary?: string; category?: string }>;
      for (const it of items) {
        const title = (it.title || '').trim();
        if (title) {
          digest.push({
            title: title.slice(0, 120),
            summary: it.summary ? String(it.summary).slice(0, 150) : undefined,
            category: it.category,
          });
        }
      }
    } catch { /* ignore */ }
  }
  digest.splice(15);
  return { traffic, digest };
}

/** Recent event descriptions (from raw_json or category+neighborhood). */
export function getRecentEvents(spec: WindowOrRange, limit = 10): string[] {
  const { start, end } = getDateRange(spec);
  const baseFilter = `event_at_utc >= ? AND event_at_utc <= ? ${REAL_DATA_FILTER}`;
  const rows = db.prepare(`
    SELECT raw_json, category, neighborhood FROM signals
    WHERE ${baseFilter}
    ORDER BY event_at_utc DESC LIMIT ?
  `).all(start, end, limit * 2) as { raw_json: string; category: string; neighborhood: string }[];
  const events: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    let text: string | null = null;
    try {
      const raw = JSON.parse(row.raw_json || '{}');
      text = raw.description || raw.title || raw.summary || raw.content;
    } catch {
      // ignore parse errors
    }
    if (!text || typeof text !== 'string') {
      text = `${row.category || 'Civic'} in ${row.neighborhood || 'Montgomery'}`;
    }
    const key = text.toLowerCase().slice(0, 80);
    if (!seen.has(key)) {
      seen.add(key);
      events.push(text.trim().slice(0, 120));
    }
    if (events.length >= limit) break;
  }
  return events;
}

/** Aggregate output for AI consumption. Optionally filtered by district. */
export function getTrendSummary(spec: WindowOrRange, district?: string): {
  totalSignals: number;
  signalsPer10k: number;
  topCategories: Array<{ category: string; count: number; delta: number }>;
  districtPressure: Array<{ district: string; count: number; status: string }>;
  events: string[];
  districtContext?: string;
  brightData?: { traffic: Array<{ road?: string; description: string; severity?: string }>; digest: Array<{ title: string; summary?: string; category?: string }> };
} {
  if (district) {
    const districtName = normalizeDistrictParam(district);
    if (!districtName) return getTrendSummary(spec);
    const signals = getSignalsInDistrict(spec, districtName);
    const totalSignals = signals.length;
    const districtPop = Math.round(MONTGOMERY_POPULATION / 9);
    const signalsPer10k = totalSignals > 0
      ? Math.round((totalSignals / districtPop) * 10000 * 10) / 10
      : 0;
    const catMap = new Map<string, number>();
    const events: string[] = [];
    const seen = new Set<string>();
    for (const s of signals) {
      const cat = (s.category ?? '').trim() || 'Uncategorized';
      catMap.set(cat, (catMap.get(cat) ?? 0) + 1);
      let text: string | null = null;
      try {
        const raw = JSON.parse(s.raw_json || '{}');
        text = raw.description || raw.title || raw.summary || raw.content;
      } catch { /* ignore */ }
      if (!text || typeof text !== 'string') {
        text = `${s.category || 'Civic'} in ${s.neighborhood || districtName}`;
      }
      const key = text.toLowerCase().slice(0, 80);
      if (!seen.has(key)) {
        seen.add(key);
        events.push(text.trim().slice(0, 120));
      }
    }
    const topCategories = Array.from(catMap.entries())
      .map(([category, count]) => ({ category, count, delta: 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    const cityTotal = getCityMetrics(spec).totalSignals;
    const numAreas = 9;
    const score = signalCountToPressureScore(totalSignals, cityTotal, numAreas);
    let status: string;
    if (score <= 25) status = 'Good';
    else if (score <= 50) status = 'Normal';
    else if (score <= 75) status = 'Elevated';
    else status = 'High priority';
    const brightData = getBrightDataEvents(spec);
    return {
      totalSignals,
      signalsPer10k,
      topCategories,
      districtPressure: [{ district: districtName, count: totalSignals, status }],
      events: events.slice(0, 10),
      districtContext: districtName,
      brightData,
    };
  }
  const metrics = getCityMetrics(spec);
  const topCategories = getTopCategories(spec);
  const districtPressure = getDistrictPressure(spec);
  const events = getRecentEvents(spec, 10);
  const brightData = getBrightDataEvents(spec);
  return {
    totalSignals: metrics.totalSignals,
    signalsPer10k: metrics.signalsPer10k,
    topCategories: topCategories.map((c) => ({ category: c.category, count: c.count, delta: c.delta })),
    districtPressure: districtPressure.map((d) => ({ district: d.district, count: d.count, status: d.status })),
    events,
    brightData,
  };
}
