/**
 * Live Traffic Feeds via Bright Data
 *
 * Scrapes Montgomery-relevant sources for incidents, closures, congestion.
 * Phase 1: Restricted to Montgomery, AL official + local news sources.
 * Post-scrape filter keeps only Montgomery-relevant items.
 */

import { scrapeUrls, ScrapedResult } from '../brightdata/browserScraper';
import db from '../storage/db';
import crypto from 'crypto';
import { isMontgomeryRelevant, isNonMontgomery } from '../utils/montgomeryFilter';
import { isTrafficFeedActive, MAX_TRAFFIC_RETENTION_HOURS } from '../utils/liveFilter';

/** Montgomery-relevant traffic sources only. Excludes Huntsville (WAFF), Birmingham-focused, etc. */
const TRAFFIC_URLS = [
  // Official ALDOT 511 – Montgomery area closures (filtered post-scrape)
  'https://aldot.511connect.com/Closures',
  'https://aldot.511connect.com/',
  'https://511.alabama.gov/',
  // Montgomery local news (WSFA, WAKA = Montgomery/Capital City)
  'https://www.wsfa.com/news/',
  'https://www.waka.com/news/',
];

/** Approximate Montgomery-area coordinates for major roads (no geocoding API). */
const ROAD_TO_COORDS: Record<string, { lat: number; lng: number }> = {
  'i65': { lat: 32.3668, lng: -86.3000 },
  'i85': { lat: 32.3668, lng: -86.3000 },
  'i459': { lat: 32.35, lng: -86.28 },
  'us80': { lat: 32.3668, lng: -86.3000 },
  'us82': { lat: 32.3668, lng: -86.3000 },
  'us231': { lat: 32.37, lng: -86.31 },
  'us31': { lat: 32.37, lng: -86.30 },
  'montgomery': { lat: 32.3668, lng: -86.3000 },
  'malfunction junction': { lat: 32.3668, lng: -86.3000 },
};

const STATEWIDE_TRAFFIC_SOURCE_PATTERNS = [/511connect\.com/i, /511\.alabama\.gov/i];
const STRONG_MONTGOMERY_TRAFFIC_PATTERNS = [
  /\bMontgomery\b/i,
  /\bMalfunction\s*Junction\b/i,
  /\bCapital\s*City\b/i,
  /\b(Eastern\s*Blvd|Atlanta\s*Hwy|Bell\s*Rd|Madison\s*Ave|Ann\s*St|Dexter\s*Ave|Vaughn\s*Rd|Fairview\s*Ave)\b/i,
];

const ROAD_PATTERNS = [
  /\bI[- ]?65\b/gi,
  /\bI[- ]?85\b/gi,
  /\bI[- ]?459\b/gi,
  /\bus\s*80\b/gi,
  /\bus\s*82\b/gi,
  /\bus\s*231\b/gi,
  /\bus\s*31\b/gi,
  /\bMontgomery\b/gi,
  /\bMalfunction\s*Junction\b/gi,
  /\bEastern\s*Blvd\b/gi,
  /\bAtlanta\s*Hwy\b/gi,
  /\bBell\s*Rd\b/gi,
  /\bMadison\s*Ave\b/gi,
  /\bAnn\s*St\b/gi,
  /\bDexter\s*Ave\b/gi,
  /\bVaughn\s*Rd\b/gi,
  /\bFairview\s*Ave\b/gi,
];

const TRAFFIC_DUPLICATE_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'into', 'is',
  'it', 'its', 'of', 'on', 'or', 'that', 'the', 'their', 'this', 'to', 'was', 'were',
  'with', 'according', 'after', 'before', 'morning', 'afternoon', 'evening', 'night',
  'early', 'late', 'today', 'tonight', 'yesterday', 'saturday', 'sunday', 'monday',
  'tuesday', 'wednesday', 'thursday', 'friday', 'near', 'over', 'under', 'news',
  'department', 'police', 'officials', 'reported', 'report', 'says', 'say', 'said',
  'still', 'continues', 'continue', 'causing', 'cause', 'capital', 'city',
]);

const TRAFFIC_EVENT_TOKENS = new Set([
  'crash', 'fatal', 'vehicle', 'construction', 'closure', 'delay', 'detour', 'lane',
  'incident', 'montgomery',
]);

function isStatewideTrafficSource(url: string): boolean {
  const candidate = (url || '').trim();
  return STATEWIDE_TRAFFIC_SOURCE_PATTERNS.some((pattern) => pattern.test(candidate));
}

function hasStrongMontgomeryTrafficEvidence(text: string): boolean {
  return STRONG_MONTGOMERY_TRAFFIC_PATTERNS.some((pattern) => pattern.test(text));
}

function findRoadReference(text: string): string | undefined {
  for (const pattern of ROAD_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[0]) return match[0];
  }
  return undefined;
}

function normalizeRoadReference(road: string | undefined): string | null {
  const value = (road || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!value) return null;
  if (value.includes('i65')) return 'i65';
  if (value.includes('i85')) return 'i85';
  if (value.includes('i459')) return 'i459';
  if (value.includes('us80') || value === '80') return 'us80';
  if (value.includes('us82') || value === '82') return 'us82';
  if (value.includes('us231')) return 'us231';
  if (value.includes('us31')) return 'us31';
  if (value.includes('easternblvd')) return 'easternblvd';
  if (value.includes('atlantahwy')) return 'atlantahwy';
  if (value.includes('bellrd')) return 'bellrd';
  if (value.includes('madisonave')) return 'madisonave';
  if (value.includes('annst')) return 'annst';
  if (value.includes('dexterave')) return 'dexterave';
  if (value.includes('vaughnrd')) return 'vaughnrd';
  if (value.includes('fairviewave')) return 'fairviewave';
  if (value.includes('malfunctionjunction')) return 'malfunctionjunction';
  if (value.includes('montgomery')) return 'montgomery';
  return value;
}

function normalizeTrafficText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/\b(accident|collision|wreck)\b/g, ' crash ')
    .replace(/\b(dead|dies|died|killed|fatality|fatalities)\b/g, ' fatal ')
    .replace(/\b(single[- ]vehicle|vehicle|car)\b/g, ' vehicle ')
    .replace(/\b(lanes)\b/g, ' lane ')
    .replace(/\b(closed|closing)\b/g, ' closure ')
    .replace(/\b(delays)\b/g, ' delay ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTrafficTokens(item: Pick<TrafficFeedItem, 'description' | 'road'>): Set<string> {
  const normalized = normalizeTrafficText(`${item.road || ''} ${item.description || ''}`);
  const tokens = normalized
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !TRAFFIC_DUPLICATE_STOP_WORDS.has(token));
  return new Set(tokens);
}

function getTrafficTimestamp(item: Pick<TrafficFeedItem, 'ingested_at_utc' | 'created_at_utc'>): number {
  const parsed = Date.parse(item.ingested_at_utc || item.created_at_utc || '');
  return Number.isFinite(parsed) ? parsed : 0;
}

function countSharedTokens(a: Set<string>, b: Set<string>, filter?: (token: string) => boolean): number {
  let count = 0;
  for (const token of a) {
    if (!b.has(token)) continue;
    if (filter && !filter(token)) continue;
    count += 1;
  }
  return count;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  const intersection = countSharedTokens(a, b);
  const union = new Set([...a, ...b]).size;
  return union > 0 ? intersection / union : 0;
}

function getTrafficEventGroup(tokens: Set<string>): 'crash' | 'roadwork' | 'delay' | 'incident' | null {
  if (tokens.has('crash') || tokens.has('fatal')) return 'crash';
  if (tokens.has('construction') || tokens.has('closure') || tokens.has('detour') || tokens.has('lane')) return 'roadwork';
  if (tokens.has('delay')) return 'delay';
  if (tokens.has('incident')) return 'incident';
  return null;
}

interface TrafficDuplicateAssessment {
  isDuplicate: boolean;
  confidence: number;
  reason?: 'same-road-overlap' | 'same-road-near-match' | 'same-city-high-overlap' | 'same-city-fatal-crash';
}

function getTrafficSourceKey(item: Pick<TrafficFeedItem, 'source_url' | 'source_label'>): string {
  return item.source_url || item.source_label || 'unknown';
}

function noTrafficDuplicateMatch(): TrafficDuplicateAssessment {
  return { isDuplicate: false, confidence: 0 };
}

function assessTrafficDuplicate(a: TrafficFeedItem, b: TrafficFeedItem): TrafficDuplicateAssessment {
  const roadA = normalizeRoadReference(a.road || findRoadReference(a.description));
  const roadB = normalizeRoadReference(b.road || findRoadReference(b.description));
  const specificRoadA = roadA && roadA !== 'montgomery' ? roadA : null;
  const specificRoadB = roadB && roadB !== 'montgomery' ? roadB : null;
  const tokensA = getTrafficTokens(a);
  const tokensB = getTrafficTokens(b);
  const eventGroupA = getTrafficEventGroup(tokensA);
  const eventGroupB = getTrafficEventGroup(tokensB);
  const overlap = jaccardSimilarity(tokensA, tokensB);
  const sharedMeaningfulTokens = countSharedTokens(tokensA, tokensB);
  const sharedEventTokens = countSharedTokens(tokensA, tokensB, (token) => TRAFFIC_EVENT_TOKENS.has(token));
  const bothMontgomery = tokensA.has('montgomery') && tokensB.has('montgomery');
  const withinEighteenHours = Math.abs(getTrafficTimestamp(a) - getTrafficTimestamp(b)) <= 18 * 60 * 60 * 1000;

  const eventGroupsConflict = Boolean(
    eventGroupA
    && eventGroupB
    && eventGroupA !== eventGroupB
    && eventGroupA !== 'incident'
    && eventGroupB !== 'incident',
  );

  if (eventGroupsConflict) {
    return noTrafficDuplicateMatch();
  }

  if (specificRoadA && specificRoadB && specificRoadA === specificRoadB && overlap >= 0.35 && sharedEventTokens >= 1) {
    return {
      isDuplicate: true,
      confidence: Math.min(0.96, Number((0.55 + overlap).toFixed(2))),
      reason: 'same-road-overlap',
    };
  }

  if (specificRoadA && specificRoadB && specificRoadA === specificRoadB && sharedMeaningfulTokens >= 3 && withinEighteenHours) {
    return {
      isDuplicate: true,
      confidence: 0.74,
      reason: 'same-road-near-match',
    };
  }

  if (
    !specificRoadA
    && !specificRoadB
    && bothMontgomery
    && tokensA.has('fatal')
    && tokensB.has('fatal')
    && tokensA.has('crash')
    && tokensB.has('crash')
    && sharedMeaningfulTokens >= 3
    && withinEighteenHours
  ) {
    return {
      isDuplicate: true,
      confidence: 0.68,
      reason: 'same-city-fatal-crash',
    };
  }

  if (!specificRoadA && !specificRoadB && bothMontgomery && overlap >= 0.6 && sharedEventTokens >= 2 && withinEighteenHours) {
    return {
      isDuplicate: true,
      confidence: Math.min(0.92, Number(Math.max(0.7, overlap).toFixed(2))),
      reason: 'same-city-high-overlap',
    };
  }

  return noTrafficDuplicateMatch();
}

export function areTrafficItemsLikelyDuplicate(a: TrafficFeedItem, b: TrafficFeedItem): boolean {
  return assessTrafficDuplicate(a, b).isDuplicate;
}

export function dedupeTrafficFeedItems(items: TrafficFeedItem[]): TrafficFeedItem[] {
  const sorted = [...items].sort(
    (a, b) => getTrafficTimestamp(b) - getTrafficTimestamp(a),
  );
  const unique: Array<{
    item: TrafficFeedItem;
    variants: TrafficFeedItem[];
    sourceKeys: Set<string>;
    mergedReportCount: number;
    suppressedDuplicateCount: number;
    maxConfidence: number;
    reason?: TrafficDuplicateAssessment['reason'];
  }> = [];

  for (const item of sorted) {
    let bestMatchIndex = -1;
    let bestAssessment: TrafficDuplicateAssessment | null = null;

    for (let index = 0; index < unique.length; index += 1) {
      let clusterAssessment: TrafficDuplicateAssessment | null = null;
      for (const variant of unique[index].variants) {
        const assessment = assessTrafficDuplicate(variant, item);
        if (!assessment.isDuplicate) continue;
        if (!clusterAssessment || assessment.confidence > clusterAssessment.confidence) {
          clusterAssessment = assessment;
        }
      }
      if (!clusterAssessment) continue;
      if (!bestAssessment || clusterAssessment.confidence > bestAssessment.confidence) {
        bestMatchIndex = index;
        bestAssessment = clusterAssessment;
      }
    }

    if (bestMatchIndex >= 0 && bestAssessment) {
      const match = unique[bestMatchIndex];
      match.mergedReportCount += 1;
      match.suppressedDuplicateCount += 1;
      match.sourceKeys.add(getTrafficSourceKey(item));
      match.variants.push({ ...item });
      if (bestAssessment.confidence >= match.maxConfidence) {
        match.maxConfidence = bestAssessment.confidence;
        match.reason = bestAssessment.reason;
      }
      continue;
    }
    unique.push({
      item: { ...item },
      variants: [{ ...item }],
      sourceKeys: new Set([getTrafficSourceKey(item)]),
      mergedReportCount: 1,
      suppressedDuplicateCount: 0,
      maxConfidence: 0,
    });
  }

  return unique.map((entry) => ({
    ...entry.item,
    dedupe_confidence: entry.maxConfidence,
    dedupe_reason: entry.reason,
    merged_report_count: entry.mergedReportCount,
    merged_source_count: entry.sourceKeys.size,
    suppressed_duplicate_count: entry.suppressedDuplicateCount,
  }));
}

/** Resolve road name to approximate Montgomery-area coords for map markers. */
function roadToCoords(road: string): { lat: number; lng: number } | undefined {
  const n = road.toLowerCase().replace(/[- ]/g, '').trim();
  if (n.includes('i65')) return ROAD_TO_COORDS['i65'];
  if (n.includes('i85')) return ROAD_TO_COORDS['i85'];
  if (n.includes('i459')) return ROAD_TO_COORDS['i459'];
  if (n.includes('us80') || (n.includes('80') && !n.includes('82'))) return ROAD_TO_COORDS['us80'];
  if (n.includes('us82') || n === '82') return ROAD_TO_COORDS['us82'];
  if (n.includes('us231')) return ROAD_TO_COORDS['us231'];
  if (n.includes('us31')) return ROAD_TO_COORDS['us31'];
  if (n.includes('montgomery') || n.includes('malfunction')) return ROAD_TO_COORDS['montgomery'];
  return undefined;
}

export interface TrafficFeedItem {
  id: string;
  source_url: string;
  source_label: string;
  road?: string;
  direction?: string;
  description: string;
  severity?: string;
  latitude?: number;
  longitude?: number;
  raw_json?: string;
  ingested_at_utc: string;
  created_at_utc: string;
  dedupe_confidence?: number;
  dedupe_reason?: 'same-road-overlap' | 'same-road-near-match' | 'same-city-high-overlap' | 'same-city-fatal-crash';
  merged_report_count?: number;
  merged_source_count?: number;
  suppressed_duplicate_count?: number;
}

/**
 * Parse scraped HTML/text for traffic incidents.
 * Looks for road names, closures, I-65, I-85, US-80, US-82, Montgomery area.
 */
export function parseIncidentsFromHtml(result: ScrapedResult): TrafficFeedItem[] {
  const items: TrafficFeedItem[] = [];
  const now = new Date().toISOString();
  const text = (result.text || '').toLowerCase();

  // Closure/incident keywords
  const incidentRegex = /\b(closure|closed|accident|crash|construction|lane\s*closed|delay|incident|detour)\b/i;

  if (incidentRegex.test(text)) {
    // Extract sentences or blocks containing incident keywords
    const sentences = text.split(/[.!?\n]+/).filter((s) => s.trim().length > 10);
    for (const sent of sentences) {
      if (incidentRegex.test(sent)) {
        const road = findRoadReference(sent) || '';
        const description = sent.replace(/\s+/g, ' ').trim().substring(0, 500);
        if (description.length > 15) {
          const descLower = description.toLowerCase();
          const severity =
            /\b(blocked|closed|closure|accident|crash|lane\s*closed|detour)\b/.test(descLower)
              ? 'high'
              : /\b(delay|congestion|heavy|construction)\b/.test(descLower)
                ? 'medium'
                : 'low';
          // Stable ID: same incident across scrapes gets replaced, not duplicated
          const id = crypto
            .createHash('sha256')
            .update(`${result.url}-${description.slice(0, 200)}`)
            .digest('hex')
            .slice(0, 24);
          const coords = road ? roadToCoords(road) : undefined;
          items.push({
            id,
            source_url: result.url,
            source_label: result.title || 'ALDOT 511',
            road: road || undefined,
            description,
            severity,
            latitude: coords?.lat,
            longitude: coords?.lng,
            ingested_at_utc: now,
            created_at_utc: now,
          });
        }
      }
    }
  }

  return dedupeTrafficFeedItems(items);
}

export function isMontgomeryTrafficItem(item: Pick<TrafficFeedItem, 'source_url' | 'source_label' | 'description' | 'road'>): boolean {
  const searchText = `${item.source_label || ''} ${item.description || ''} ${item.road || ''}`.trim();
  if (!searchText) return false;
  if (isNonMontgomery(searchText)) return false;
  if (isStatewideTrafficSource(item.source_url || '')) {
    return hasStrongMontgomeryTrafficEvidence(searchText);
  }
  return isMontgomeryRelevant(searchText);
}

/** Default non-live feed window for the traffic panel. */
const TRAFFIC_FEED_DEFAULT_WINDOW_HOURS = 12;

/**
 * Refresh traffic feeds via Bright Data scraping.
 * Purges feeds older than the maximum lifecycle retention horizon so longer-running
 * roadwork / closure items survive across refresh cycles.
 */
export async function refreshTrafficFeeds(): Promise<TrafficFeedItem[]> {
  if (!process.env.BRIGHTDATA_BROWSER_WSS) {
    throw new Error('BRIGHTDATA_BROWSER_WSS is not configured');
  }

  const now = new Date().toISOString();
  const cutoff = new Date(Date.now() - MAX_TRAFFIC_RETENTION_HOURS * 60 * 60 * 1000).toISOString();
  const purged = db.prepare('DELETE FROM traffic_feeds WHERE ingested_at_utc < ?').run(cutoff);
  if (purged.changes > 0) {
    console.log(`[Traffic Feed] Purged ${purged.changes} feeds older than ${MAX_TRAFFIC_RETENTION_HOURS}h.`);
  }

  let scrapedResults: ScrapedResult[] = [];

  try {
    scrapedResults = await scrapeUrls(TRAFFIC_URLS, 2);
  } catch (err) {
    console.error('[Traffic Feed] Scraping failed:', err);
    throw err;
  }

  const allItems: TrafficFeedItem[] = [];
  for (const r of scrapedResults) {
    const items = parseIncidentsFromHtml(r);
    console.log(`[Traffic Feed] Source: ${r.url} → raw items: ${items.length}`);
    allItems.push(...items);
  }

  const rawCount = allItems.length;
  const montgomeryItems = allItems.filter((item) => isMontgomeryTrafficItem(item));
  const excludedCount = rawCount - montgomeryItems.length;
  if (excludedCount > 0) {
    console.log(`[Traffic Feed] Montgomery filter: ${rawCount} raw → ${montgomeryItems.length} kept, ${excludedCount} excluded`);
  }

  if (montgomeryItems.length === 0) {
    console.log('[Traffic Feed] No Montgomery-relevant incidents this run; stale data already purged.');
    return [];
  }

  const unique = dedupeTrafficFeedItems(montgomeryItems);

  const insert = db.prepare(`
    INSERT OR REPLACE INTO traffic_feeds (
      id, source_url, source_label, road, direction, description, severity, latitude, longitude, raw_json, ingested_at_utc, created_at_utc
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const tx = db.transaction((items: TrafficFeedItem[]) => {
    for (const i of items) {
      insert.run(
        i.id,
        i.source_url,
        i.source_label,
        i.road ?? null,
        i.direction ?? null,
        i.description,
        i.severity ?? null,
        i.latitude ?? null,
        i.longitude ?? null,
        i.raw_json ?? null,
        i.ingested_at_utc,
        i.created_at_utc
      );
    }
  });

  tx(unique);
  console.log(`[Traffic Feed] Stored ${unique.length} Montgomery-only items from Bright Data.`);
  return unique;
}

/**
 * Get latest traffic feeds from DB.
 * @param live - When true, evaluate active lifecycle state; otherwise return the last 12h.
 */
export function getLatestTrafficFeeds(live = false): TrafficFeedItem[] {
  const hours = live ? MAX_TRAFFIC_RETENTION_HOURS : TRAFFIC_FEED_DEFAULT_WINDOW_HOURS;
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const rows = db
    .prepare(
      `SELECT * FROM traffic_feeds WHERE ingested_at_utc >= ? ORDER BY ingested_at_utc DESC LIMIT 200`
    )
    .all(cutoff) as TrafficFeedItem[];
  const montgomeryRows = rows.filter((item) => isMontgomeryTrafficItem(item));
  const visibleRows = live ? montgomeryRows.filter((item) => isTrafficFeedActive(item)) : montgomeryRows;
  return dedupeTrafficFeedItems(visibleRows).slice(0, 50);
}
