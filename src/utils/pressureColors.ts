/**
 * Credit-score style pressure colors: good → emergency.
 * Aligned across map polygons, trend engine, and City Pulse.
 *
 * 0–25: Green – Good (low demand, healthy)
 * 25–50: Yellow – Caution (moderate)
 * 50–75: Orange – Attention needed (elevated)
 * 75–100: Red – Emergency / high priority
 */

export const PRESSURE_COLORS = {
  good: '#22c55e',      // green-500
  caution: '#eab308',   // yellow-500
  attention: '#f97316', // orange-500
  emergency: '#ef4444', // red-500
} as const;

/** Convert a pressure score (0–100) to credit-score color. */
export function pressureScoreToColor(score: number): string {
  if (score <= 25) return PRESSURE_COLORS.good;
  if (score <= 50) return PRESSURE_COLORS.caution;
  if (score <= 75) return PRESSURE_COLORS.attention;
  return PRESSURE_COLORS.emergency;
}

/** Human-readable label for pressure level. */
export function pressureScoreToLabel(score: number): string {
  if (score <= 25) return 'Good';
  if (score <= 50) return 'Caution';
  if (score <= 75) return 'Attention needed';
  return 'High priority';
}

/** Normalize district names: "District 1" → "district 1". */
export function normalizeDistrictKey(name: string): string {
  const n = (name || '').trim().toLowerCase();
  if (!n) return n;
  const m = n.match(/district\s*(\d+)/);
  return m ? `district ${m[1]}` : n;
}

/**
 * Normalize neighborhood names from ArcGIS/ingest to canonical keys matching montgomery.json.
 * Polygon names: "West Montgomery", "Downtown", "EastChase".
 */
export function normalizeNeighborhoodKey(name: string): string {
  const n = (name || '').trim().toLowerCase();
  if (!n || n === 'unknown') return n;
  if (n.includes('west') && n.includes('montgom')) return 'west montgomery';
  if (n.includes('downtown')) return 'downtown';
  if (n.includes('east') && (n.includes('chase') || n === 'eastchase')) return 'eastchase';
  return n;
}

/**
 * Compute pressure score (0–100) from signal count.
 * Uses city-wide baseline: above median = higher score.
 * @param count signals in area
 * @param cityTotal total signals city-wide
 * @param cityAreas number of areas (for baseline)
 */
export function signalCountToPressureScore(
  count: number,
  cityTotal: number,
  cityAreas: number
): number {
  if (cityTotal === 0) return 0;
  const avgPerArea = cityTotal / Math.max(cityAreas, 1);
  if (avgPerArea === 0) return 0;
  const ratio = count / avgPerArea;
  // ratio 0 = 0, ratio 1 = 50, ratio 2+ = 75–100
  const score = Math.min(100, Math.round(ratio * 50));
  return score;
}
