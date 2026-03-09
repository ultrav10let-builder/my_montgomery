/**
 * Map Bright Data traffic feeds to road colors.
 * Road polylines colored by severity: green (clear), yellow (slow), orange (heavy), red (blocked/accident).
 */

export interface TrafficFeedItem {
  id: string;
  road?: string;
  severity?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
}

/** Severity → pressure score 0–100. Blocked/accident=red, heavy=orange, slow=yellow, clear=green */
export function severityToPressureScore(severity?: string, description?: string): number {
  const desc = (description || '').toLowerCase();
  const sev = (severity || '').toLowerCase();
  if (desc.includes('blocked') || desc.includes('closure') || desc.includes('accident') || desc.includes('crash') || sev.includes('high')) return 90;
  if (desc.includes('heavy') || desc.includes('congestion') || desc.includes('delay') || sev.includes('medium')) return 55;
  if (desc.includes('slow') || sev.includes('low')) return 30;
  return 0;
}

/** Normalize road ref for matching: "I-65" → "i65", "US 80" → "us80" */
export function normalizeRoadRef(ref: string): string {
  return ref.toLowerCase().replace(/[- ]/g, '').trim();
}

/** Extract road refs from feed for matching OSM ref. Returns normalized keys. */
export function getRoadRefsFromFeed(feed: TrafficFeedItem): string[] {
  const refs: string[] = [];
  if (feed.road) {
    const n = normalizeRoadRef(feed.road);
    if (n.includes('i65') || n === 'i65') refs.push('i65');
    if (n.includes('i85') || n === 'i85') refs.push('i85');
    if (n.includes('i459')) refs.push('i459');
    if ((n.includes('us80') || n.includes('80')) && !n.includes('82')) refs.push('us80');
    if (n.includes('us82') || n === '82') refs.push('us82');
    if (n.includes('us231')) refs.push('us231');
    if (n.includes('us31')) refs.push('us31');
    if (refs.length === 0) refs.push(n);
  }
  return refs;
}

/** Get score for an OSM way ref (e.g. "I 65;US 82") from road scores */
export function getScoreForOsmRef(osmRef: string, roadScores: Record<string, number>): number {
  if (!osmRef) return 0;
  const osmRefs = osmRef.split(';').map((r) => normalizeRoadRef(r.trim()));
  let best = 0;
  for (const r of osmRefs) {
    const score = roadScores[r] ?? roadScores[r.replace(/\s/g, '')] ?? 0;
    best = Math.max(best, score);
  }
  return best;
}

/**
 * Compute best (worst) severity score per road ref from feeds.
 * Returns Record<normalizedRef, score 0-100>
 */
export function trafficFeedsToRoadScores(feeds: TrafficFeedItem[]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const feed of feeds) {
    const score = severityToPressureScore(feed.severity, feed.description);
    const refs = getRoadRefsFromFeed(feed);
    for (const ref of refs) {
      const key = normalizeRoadRef(ref);
      scores[key] = Math.max(scores[key] ?? 0, score);
    }
  }
  return scores;
}
