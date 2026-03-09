/**
 * Insight Input Builder – compact, deterministic civic intelligence dataset for AI analysis.
 * Uses trend engine and BrightData; no OpenAI calls.
 * All fields match actual schema: event_at_utc, category, neighborhood, ingested_at_utc, date_key, items_json.
 */

import {
  getCityMetrics,
  getTopCategories,
  getDistrictPressure,
  getTrendChanges,
  getBrightDataEvents,
  getTrendSummary,
  getInsightCacheLabel,
  normalizeDistrictParam,
  type WindowOrRange,
} from './trendEngine';

export type Window = '7d' | '30d' | '90d';

const MAX_CATEGORIES = 5;
const MAX_NEIGHBORHOODS = 5;
const MAX_TRAFFIC_ITEMS = 3;
const MAX_DIGEST_ITEMS = 3;
const MAX_STRING_LEN = 80;

export interface InsightInput {
  window: string;
  totalSignals: number;
  signalsPer10k: number;
  topCategories: Array<{ category: string; count: number; delta: number }>;
  topNeighborhoods: Array<{ neighborhood: string; count: number; status: string }>;
  notableChange: { type: 'category' | 'neighborhood'; name: string; delta: number; direction: string } | null;
  brightData: {
    traffic: Array<{ road?: string; description: string }>;
    digest: Array<{ title: string; category?: string }>;
  };
  /** When set, AI should prioritize insight for this district. */
  districtContext?: string;
}

function trunc(s: string, len: number): string {
  return (s || '').trim().slice(0, len);
}

/**
 * Build structured AI insight input for a time window. Optionally scoped to district.
 * Deterministic, compact, suitable for model consumption.
 */
export function buildInsightInput(spec: WindowOrRange, district?: string): InsightInput {
  const windowLabel = getInsightCacheLabel(spec);
  if (district) {
    const districtName = normalizeDistrictParam(district);
    if (districtName) {
      const summary = getTrendSummary(spec, districtName);
      return buildInsightInputFromTrendSummary(windowLabel, {
        ...summary,
        notableChange: undefined,
        brightData: summary.brightData ?? { traffic: [], digest: [] },
      });
    }
  }
  const metrics = getCityMetrics(spec);
  const topCategories = getTopCategories(spec)
    .slice(0, MAX_CATEGORIES)
    .map((c) => ({ category: c.category, count: c.count, delta: c.delta }));

  const districtPressure = getDistrictPressure(spec);
  const trendChanges = getTrendChanges(spec);
  let notableChange: InsightInput['notableChange'] = null;
  const catMovers = trendChanges.categories
    .filter((c) => c.delta !== 0)
    .map((c) => ({ type: 'category' as const, name: c.category, delta: c.delta }));
  const neighMovers = trendChanges.districts
    .filter((d) => d.delta !== 0)
    .map((d) => ({ type: 'neighborhood' as const, name: d.district, delta: d.delta }));
  const allMovers = [...catMovers, ...neighMovers].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  if (allMovers.length > 0) {
    const m = allMovers[0];
    notableChange = {
      type: m.type,
      name: m.name,
      delta: m.delta,
      direction: m.delta > 0 ? 'up' : 'down',
    };
  }

  const bd = getBrightDataEvents(spec);
  const traffic = bd.traffic
    .slice(0, MAX_TRAFFIC_ITEMS)
    .map((t) => ({ road: t.road, description: trunc(t.description, MAX_STRING_LEN) }));
  const digest = bd.digest
    .slice(0, MAX_DIGEST_ITEMS)
    .map((d) => ({ title: trunc(d.title, MAX_STRING_LEN), category: d.category }));

  return buildInsightInputFromTrendSummary(windowLabel, {
    totalSignals: metrics.totalSignals,
    signalsPer10k: metrics.signalsPer10k,
    topCategories,
    districtPressure: districtPressure.map((d) => ({ district: d.district, count: d.count, status: d.status })),
    notableChange,
    brightData: { traffic, digest },
  });
}

function buildInsightInputFromTrendSummary(
  windowLabel: string,
  data: {
    totalSignals: number;
    signalsPer10k: number;
    topCategories: Array<{ category: string; count: number; delta: number }>;
    districtPressure: Array<{ district: string; count: number; status: string }>;
    notableChange?: InsightInput['notableChange'];
    brightData: { traffic: Array<{ road?: string; description: string }>; digest: Array<{ title: string; category?: string }> };
    districtContext?: string;
  }
): InsightInput {
  const topCategories = data.topCategories.slice(0, MAX_CATEGORIES);
  const topNeighborhoods = data.districtPressure
    .slice(0, MAX_NEIGHBORHOODS)
    .map((d) => ({ neighborhood: d.district, count: d.count, status: d.status }));
  const traffic = data.brightData.traffic.slice(0, MAX_TRAFFIC_ITEMS).map((t) => ({
    road: t.road,
    description: trunc(t.description, MAX_STRING_LEN),
  }));
  const digest = data.brightData.digest.slice(0, MAX_DIGEST_ITEMS).map((d) => ({
    title: trunc(d.title, MAX_STRING_LEN),
    category: d.category,
  }));

  const input: InsightInput = {
    window: windowLabel,
    totalSignals: data.totalSignals,
    signalsPer10k: data.signalsPer10k,
    topCategories,
    topNeighborhoods,
    notableChange: data.notableChange ?? null,
    brightData: { traffic, digest },
    districtContext: data.districtContext,
  };

  const catCount = input.topCategories.length;
  const neighCount = input.topNeighborhoods.length;
  const eventCount = input.brightData.traffic.length + input.brightData.digest.length;
  console.log(
    `[InsightInput] Built for ${windowLabel}: categories=${catCount}, neighborhoods=${neighCount}, events=${eventCount}`
  );

  return input;
}
