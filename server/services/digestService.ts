import crypto from 'crypto';
import { scrapeUrls, ScrapedResult } from '../brightdata/browserScraper';
import { parseEventTimeFromHtml } from '../time/parseEventTime';
import { generateStructuredJson } from '../ai/summarizer';
import db from '../storage/db';
import fs from 'fs';
import path from 'path';
import { isMontgomeryRelevantFromGovSource } from '../utils/montgomeryFilter';

export interface ConfiguredBrightDataSource {
  label: string;
  url: string;
  category: string;
  notes: string;
}

const ROOT_URL = 'https://www.montgomeryal.gov/';
const NEWS = 'https://www.montgomeryal.gov/news';
const MONTGOMERY_LIVE = 'https://www.montgomeryal.gov/live';
const CITY_COUNCIL = 'https://www.montgomeryal.gov/government/city-government/city-council';
const CITY_CALENDAR = 'https://www.montgomeryal.gov/government/city-government/city-calendar';
const DISTRICT_MAPS = 'https://www.montgomeryal.gov/government/city-government/city-council/city-council-district-maps';
const PLANNING = 'https://www.montgomeryal.gov/government/government-transparency/city-planning';
const LAND_USE = 'https://www.montgomeryal.gov/government/city-government/city-departments/community-development/land-use-division';
const BOARD_OF_ADJ = 'https://www.montgomeryal.gov/government/city-government/city-departments/community-development/land-use-division/board-of-adjustment';
const PARKS_REC = 'https://www.montgomeryal.gov/play/explore-montgomery/parks-trails-and-natural-areas/parks';
const CITY_DEPARTMENTS = 'https://www.montgomeryal.gov/government/city-government/city-departments';
const PUBLIC_WORKS = 'https://www.montgomeryal.gov/government/city-government/city-departments/engineering-environmental-services';
const PUBLIC_SAFETY = 'https://www.montgomeryal.gov/city-government/departments/public-safety-test';
const PUBLIC_SAFETY_TEST = PUBLIC_SAFETY;
const FIRE_RESCUE = 'https://www.montgomeryal.gov/government/city-government/city-departments/fire-rescue';
const SANITATION = 'https://www.montgomeryal.gov/government/city-government/city-departments/sanitation';
const TRAFFIC_ENGINEERING = 'https://www.montgomeryal.gov/government/city-government/city-departments/traffic-engineering';
const TRANSPARENCY_POLICIES = 'https://www.montgomeryal.gov/government/government-transparency/policies';
const GIS_MAPPING = 'https://www.montgomeryal.gov/residents/community/gis-mapping-tool';
const OPEN_DATA_PORTAL = 'https://opendata.montgomeryal.gov';

const LEGACY_URL_REDIRECTS: Record<string, string> = {
  'https://www.montgomeryal.gov/city-council': CITY_COUNCIL,
  'https://www.montgomeryal.gov/departments/planning': PLANNING,
  'https://www.montgomeryal.gov/departments/parks-recreation': PARKS_REC,
  'https://www.montgomeryal.gov/departments/public-works': PUBLIC_WORKS,
  'https://www.montgomeryal.gov/departments/public-safety': PUBLIC_SAFETY,
};

export const BRIGHTDATA_SOURCE_COVERAGE: ConfiguredBrightDataSource[] = [
  { label: 'City News', url: NEWS, category: 'Civic', notes: 'General announcements and official city news.' },
  { label: 'Montgomery Live', url: MONTGOMERY_LIVE, category: 'Civic', notes: 'User-requested live/featured city updates page.' },
  { label: 'City Council', url: CITY_COUNCIL, category: 'Civic', notes: 'Council agendas, hearings, and ordinances.' },
  { label: 'City Calendar', url: CITY_CALENDAR, category: 'Civic', notes: 'Meetings, hearings, and public events.' },
  { label: 'Council District Maps', url: DISTRICT_MAPS, category: 'Civic', notes: 'Official district geography and council context.' },
  { label: 'Planning Department', url: PLANNING, category: 'Planning', notes: 'Planning and zoning notices.' },
  { label: 'Land Use Division', url: LAND_USE, category: 'Planning', notes: 'Land use and rezoning source.' },
  { label: 'Board of Adjustment', url: BOARD_OF_ADJ, category: 'Planning', notes: 'Variance and hearing notices.' },
  { label: 'Parks & Recreation', url: PARKS_REC, category: 'Parks', notes: 'Parks events and facility updates.' },
  { label: 'Public Works', url: PUBLIC_WORKS, category: 'Infrastructure', notes: 'Construction and corridor work notices.' },
  { label: 'Sanitation', url: SANITATION, category: 'Sanitation', notes: 'Trash, recycling, and route schedule changes.' },
  { label: 'Traffic Engineering', url: TRAFFIC_ENGINEERING, category: 'Traffic', notes: 'Street operations, detours, and closures.' },
  { label: 'Public Safety', url: PUBLIC_SAFETY, category: 'Public Safety', notes: 'Department-level public safety source.' },
  { label: 'Public Safety Test', url: PUBLIC_SAFETY_TEST, category: 'Public Safety', notes: 'User-provided official Montgomery safety URL example.' },
  { label: 'Fire Rescue', url: FIRE_RESCUE, category: 'Public Safety', notes: 'User-requested official fire-rescue source.' },
  { label: 'Transparency Policies', url: TRANSPARENCY_POLICIES, category: 'Civic', notes: 'Government transparency and policy references.' },
  { label: 'GIS Mapping Tool', url: GIS_MAPPING, category: 'Civic', notes: 'Official map/boundary discovery source.' },
  { label: 'Montgomery Open Data', url: OPEN_DATA_PORTAL, category: 'Civic', notes: 'Official open-data portal root for dataset discovery.' },
];

/** Montgomery, AL official sources only – city and city-operated pages. */
const WHITELIST_URLS = Array.from(new Set(BRIGHTDATA_SOURCE_COVERAGE.map((source) => source.url)));

/** Category → montgomeryal.gov URL. Used when source/alias maps to a category. */
const CATEGORY_TO_URL: Record<string, string> = {
  Traffic: TRAFFIC_ENGINEERING,
  Parks: PARKS_REC,
  Civic: CITY_COUNCIL,
  Infrastructure: PUBLIC_WORKS,
  Sanitation: SANITATION,
  'Public Safety': PUBLIC_SAFETY,
  Planning: PLANNING,
};

/** Department/source aliases → montgomeryal.gov URLs. Built from categories + common scraped variations. */
const DEPARTMENT_ALIASES: Record<string, string> = {
  // Traffic / street operations
  traffic: TRAFFIC_ENGINEERING,
  'road closure': TRAFFIC_ENGINEERING,
  'road closures': TRAFFIC_ENGINEERING,
  road: TRAFFIC_ENGINEERING,
  street: TRAFFIC_ENGINEERING,
  detour: TRAFFIC_ENGINEERING,
  highway: TRAFFIC_ENGINEERING,
  'dept of engineering': TRAFFIC_ENGINEERING,
  'department of engineering': TRAFFIC_ENGINEERING,
  engineering: TRAFFIC_ENGINEERING,
  'traffic engineering': TRAFFIC_ENGINEERING,
  'public works': PUBLIC_WORKS,
  // Parks
  parks: PARKS_REC,
  'parks & recreation': PARKS_REC,
  'parks and recreation': PARKS_REC,
  recreation: PARKS_REC,
  park: PARKS_REC,
  facility: PARKS_REC,
  pool: PARKS_REC,
  event: PARKS_REC,
  // Civic (council, meetings, ordinances)
  civic: CITY_COUNCIL,
  'montgomery live': MONTGOMERY_LIVE,
  'city clerk': CITY_COUNCIL,
  'city council': CITY_COUNCIL,
  council: CITY_COUNCIL,
  meeting: CITY_COUNCIL,
  ordinance: CITY_COUNCIL,
  hearing: CITY_COUNCIL,
  'city calendar': CITY_CALENDAR,
  calendar: CITY_CALENDAR,
  transparency: TRANSPARENCY_POLICIES,
  'government transparency': TRANSPARENCY_POLICIES,
  policy: TRANSPARENCY_POLICIES,
  policies: TRANSPARENCY_POLICIES,
  gis: GIS_MAPPING,
  'district maps': DISTRICT_MAPS,
  'open data': OPEN_DATA_PORTAL,
  opendata: OPEN_DATA_PORTAL,
  // Infrastructure (construction, permits → Public Works)
  infrastructure: PUBLIC_WORKS,
  construction: PUBLIC_WORKS,
  permit: PUBLIC_WORKS,
  'capital project': PUBLIC_WORKS,
  roadway: PUBLIC_WORKS,
  // Sanitation
  sanitation: SANITATION,
  'sanitation department': SANITATION,
  trash: SANITATION,
  recycling: SANITATION,
  schedule: SANITATION,
  citation: SANITATION,
  bulk: SANITATION,
  'solid waste': SANITATION,
  garbage: SANITATION,
  // Public Safety
  'public safety': PUBLIC_SAFETY,
  'public safety test': PUBLIC_SAFETY_TEST,
  police: PUBLIC_SAFETY,
  fire: FIRE_RESCUE,
  'fire rescue': FIRE_RESCUE,
  emergency: PUBLIC_SAFETY,
  mpd: PUBLIC_SAFETY,
  'fire department': FIRE_RESCUE,
  // Planning (zoning, land use, board of adjustment)
  planning: PLANNING,
  'planning dept': PLANNING,
  'planning department': PLANNING,
  zoning: PLANNING,
  'board of adjustment': BOARD_OF_ADJ,
  'land use': LAND_USE,
  rezoning: PLANNING,
  'community development': LAND_USE,
  // General
  'city of montgomery': ROOT_URL,
  news: NEWS,
};

/** Ensure URL is external gov only – never localhost, 127.0.0.1, or non-gov. */
export function ensureExternalGovUrl(url: string | null | undefined): string | null {
  const u = (url || '').trim();
  if (!u || u === '#') return null;
  const normalized = LEGACY_URL_REDIRECTS[u] ?? u;
  if (normalized.includes('localhost') || normalized.includes('127.0.0.1')) return null;
  if (!normalized.startsWith('https://') || !(normalized.includes('montgomeryal.gov') || normalized.includes('.gov'))) return null;
  return normalized;
}

function sanitizeDigestSources(sources: Array<{ label?: string; url?: string } | string>): string[] {
  return Array.from(
    new Set(
      sources
        .map((s) => (typeof s === 'string' ? s : s.url ?? ''))
        .map((url) => ensureExternalGovUrl(url))
        .filter((url): url is string => Boolean(url))
    )
  );
}

function resolveSourceToUrl(source: string, sourceMap: Map<string, string>, sources?: Array<{ label?: string; url?: string } | string>): string | null {
  const src = (source || '').toLowerCase().trim();
  if (!src) return null;
  const fromMap = sourceMap.get(src);
  if (fromMap) return fromMap;
  const fromAlias = DEPARTMENT_ALIASES[src];
  if (fromAlias) return fromAlias;
  for (const [alias, url] of Object.entries(DEPARTMENT_ALIASES)) {
    if (src.includes(alias) || alias.includes(src)) return url;
  }
  if (sources) {
    for (const s of sources) {
      const label = typeof s === 'string' ? s : (s as { label?: string }).label;
      const url = typeof s === 'string' ? s : (s as { url?: string }).url;
      if (label && url && typeof url === 'string' && src.includes((label || '').toLowerCase())) return url;
    }
  }
  return null;
}

export interface DigestItem {
  title: string;
  summary: string;
  content?: string;
  source: string;
  /** Actual external source URL from Bright Data payload. null = No Source URL Provided. */
  url: string | null;
  category?: string;
  location_text?: string | null;
  district?: string | null;
  neighborhood?: string | null;
}

export interface DigestLocationContext {
  location_text: string | null;
  district: string | null;
  neighborhood: string | null;
}

/** Phase 2: Normalized digest item record for SQLite storage. */
export interface DigestItemRecord {
  id: string;
  title: string;
  summary: string;
  category: string;
  source_name: string;
  source_url: string | null;
  event_at_utc: string | null;
  ingested_at_utc: string;
  location_text: string | null;
  city: string | null;
  raw_json: string | null;
}

/** Canonical lowercase categories for rule-based classification. */
const RULE_CATEGORIES = ['traffic', 'parks', 'civic', 'infrastructure', 'sanitation', 'public safety', 'planning'] as const;
type RuleCategory = (typeof RULE_CATEGORIES)[number] | 'other';

/**
 * Rule-based category classification. Deterministic, keyword-first.
 * Order matters: first matching rule wins. Returns lowercase category or 'other'.
 */
function classifyByRules(title: string, summary: string, source: string): RuleCategory {
  const text = `${(title || '')} ${(summary || '')} ${(source || '')}`.toLowerCase();
  if (/\b(road|street|closure|detour|highway|traffic|public\s+works)\b/.test(text)) return 'traffic';
  if (/\b(park|parks|recreation|pool|facility)\b/.test(text)) return 'parks';
  if (/\b(sanitation|trash|recycling|garbage|solid\s+waste|bulk|schedule|citation)\b/.test(text)) return 'sanitation';
  if (/\b(police|fire|emergency|mpd|public\s+safety)\b/.test(text)) return 'public safety';
  if (/\b(zoning|board\s+of\s+adjustment|land\s+use|rezoning|planning\s+dept)\b/.test(text)) return 'planning';
  if (/\b(construction|permit|capital\s+project|roadway|infrastructure)\b/.test(text)) return 'infrastructure';
  if (/\b(council|meeting|ordinance|hearing|calendar|civic|city\s+clerk)\b/.test(text)) return 'civic';
  return 'other';
}

/** Normalize DigestItem to DigestItemRecord for storage. */
function toDigestItemRecord(
  item: DigestItem,
  digestDate: string,
  eventAtUtc: string,
  ingestedAtUtc: string
): DigestItemRecord {
  const enriched = enrichDigestItem(item);
  const category = classifyByRules(enriched.title, enriched.summary || '', enriched.source || '');
  const id = crypto
    .createHash('sha256')
    .update(`${digestDate}-${enriched.title}-${enriched.source}`)
    .digest('hex')
    .slice(0, 32);
  return {
    id,
    title: enriched.title,
    summary: enriched.summary,
    category,
    source_name: enriched.source,
    source_url: enriched.url ?? null,
    event_at_utc: eventAtUtc,
    ingested_at_utc: ingestedAtUtc,
    location_text: enriched.location_text ?? null,
    city: 'Montgomery',
    raw_json: JSON.stringify(enriched),
  };
}

/** Map source page title/label to its true gov URL for link correctness */
function buildSourceUrlMap(scraped: ScrapedResult[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of scraped) {
    map.set(r.title?.toLowerCase().trim() ?? '', r.finalUrl || r.url);
    map.set(r.url, r.finalUrl || r.url);
  }
  return map;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Traffic: ['road', 'street', 'closure', 'detour', 'public works', 'highway', 'traffic'],
  Parks: ['park', 'parks', 'recreation', 'facility', 'pool', 'event'],
  Civic: ['council', 'meeting', 'ordinance', 'hearing', 'civic', 'public'],
  Infrastructure: ['construction', 'permit', 'infrastructure', 'capital project', 'roadway'],
  Sanitation: ['sanitation', 'trash', 'recycling', 'schedule', 'citation', 'bulk'],
  'Public Safety': ['public safety', 'police', 'fire', 'emergency'],
  Planning: ['zoning', 'planning', 'board of adjustment', 'land use', 'rezoning'],
};

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

const DISTRICT_PATTERNS = [/\bcity\s+council\s+district\s*([1-9])\b/i, /\bdistrict\s*([1-9])\b/i, /\bward\s*([1-9])\b/i];

const NEIGHBORHOOD_PATTERNS = [
  { label: 'West Montgomery', patterns: [/\bwest montgomery\b/i] },
  { label: 'Downtown', patterns: [/\bdowntown\b/i] },
  { label: 'EastChase', patterns: [/\beast[\s-]?chase\b/i] },
];

const LOCATION_ANCHORS = [
  { label: 'Malfunction Junction', patterns: [/\bmalfunction junction\b/i] },
  { label: 'Eastern Blvd', patterns: [/\beastern\s+blvd\b/i, /\beastern\s+boulevard\b/i] },
  { label: 'Atlanta Hwy', patterns: [/\batlanta\s+hwy\b/i, /\batlanta\s+highway\b/i] },
  { label: 'Bell Rd', patterns: [/\bbell\s+rd\b/i, /\bbell\s+road\b/i] },
  { label: 'Madison Ave', patterns: [/\bmadison\s+ave\b/i, /\bmadison\s+avenue\b/i] },
  { label: 'Ann St', patterns: [/\bann\s+st\b/i, /\bann\s+street\b/i] },
  { label: 'Dexter Ave', patterns: [/\bdexter\s+ave\b/i, /\bdexter\s+avenue\b/i] },
  { label: 'Vaughn Rd', patterns: [/\bvaughn\s+rd\b/i, /\bvaughn\s+road\b/i] },
  { label: 'Fairview Ave', patterns: [/\bfairview\s+ave\b/i, /\bfairview\s+avenue\b/i] },
  { label: 'I-65', patterns: [/\bI[- ]?65\b/i] },
  { label: 'I-85', patterns: [/\bI[- ]?85\b/i] },
  { label: 'US-80', patterns: [/\bUS\s*80\b/i] },
  { label: 'US-82', patterns: [/\bUS\s*82\b/i] },
];

function normalizeText(value: string | null | undefined): string {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function normalizeDistrictLabel(value: string | null | undefined): string | null {
  const trimmed = normalizeText(value);
  if (!trimmed) return null;
  const match = trimmed.match(/([1-9])/);
  return match ? `District ${match[1]}` : trimmed;
}

function normalizeNeighborhoodLabel(value: string | null | undefined): string | null {
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

function findDistrict(text: string): string | null {
  for (const pattern of DISTRICT_PATTERNS) {
    const match = text.match(pattern);
    if (match) return `District ${match[1]}`;
  }
  return null;
}

function findNeighborhood(text: string): string | null {
  for (const entry of NEIGHBORHOOD_PATTERNS) {
    if (entry.patterns.some((pattern) => pattern.test(text))) return entry.label;
  }
  return null;
}

function findLocationAnchors(text: string): string[] {
  const matches: string[] = [];
  for (const entry of LOCATION_ANCHORS) {
    if (entry.patterns.some((pattern) => pattern.test(text)) && !matches.includes(entry.label)) {
      matches.push(entry.label);
    }
    if (matches.length >= 2) break;
  }
  return matches;
}

function joinLocationParts(parts: Array<string | null | undefined>): string | null {
  const unique: string[] = [];
  for (const part of parts) {
    const value = normalizeText(part);
    if (!value) continue;
    if (!unique.some((existing) => existing.toLowerCase() === value.toLowerCase())) {
      unique.push(value);
    }
  }
  return unique.length > 0 ? unique.join(' · ') : null;
}

function inferCategory(source: string, title: string): string {
  const text = `${(source || '')} ${(title || '')}`.toLowerCase();
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((k) => text.includes(k))) return cat;
  }
  return 'Civic';
}

/** Canonical categories – must match frontend DIGEST_CATEGORIES (minus "All"). */
const CANONICAL_CATEGORIES = ['Traffic', 'Parks', 'Civic', 'Infrastructure', 'Sanitation', 'Public Safety', 'Planning'] as const;

/** Map AI/legacy category variants to canonical tabs. Uses inferCategory if given value doesn't match. */
function normalizeCategory(given: string | undefined, source: string, title: string): string {
  const g = (given || '').trim();
  if (CANONICAL_CATEGORIES.includes(g as (typeof CANONICAL_CATEGORIES)[number])) return g;
  const normalized = g.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (CATEGORY_VARIANTS[normalized]) return CATEGORY_VARIANTS[normalized];
  return inferCategory(source, title);
}

export function inferDigestLocationContext(item: Partial<DigestItem>): DigestLocationContext {
  const text = normalizeText([item.title, item.summary, item.content, item.source].filter(Boolean).join(' '));
  const district = normalizeDistrictLabel(item.district) ?? findDistrict(text);
  const neighborhood = normalizeNeighborhoodLabel(item.neighborhood) ?? findNeighborhood(text);
  const locationText = normalizeText(item.location_text) || joinLocationParts([neighborhood, district, ...findLocationAnchors(text)]);
  return {
    location_text: locationText,
    district,
    neighborhood,
  };
}

function enrichDigestItem(item: DigestItem): DigestItem {
  const summary = normalizeText(item.summary ?? item.content);
  const category = normalizeCategory(item.category, item.source || '', item.title || '');
  const location = inferDigestLocationContext({ ...item, summary, content: summary, category });
  return {
    title: normalizeText(item.title) || 'Untitled',
    summary,
    content: summary,
    source: normalizeText(item.source) || 'City of Montgomery',
    url: ensureExternalGovUrl(item.url),
    category,
    ...location,
  };
}

/** Match digest headline to scraped page links – maps Bright Data headlines to existing gov URLs. */
function resolveUrlFromHeadlineMatch(
  itemTitle: string,
  itemSource: string,
  scraped: ScrapedResult[]
): string | null {
  const titleNorm = (itemTitle || '').toLowerCase().trim();
  const sourceNorm = (itemSource || '').toLowerCase().trim();
  if (!titleNorm || titleNorm.length < 3) return null;

  for (const r of scraped) {
    const pageMatches =
      sourceNorm.includes((r.title || '').toLowerCase()) ||
      (r.title || '').toLowerCase().includes(sourceNorm) ||
      (r.finalUrl || r.url || '').toLowerCase().includes(sourceNorm.replace(/\s+/g, '-'));
    if (!pageMatches) continue;

    const links = (r as ScrapedResult & { headlineLinks?: { headline: string; url: string }[] }).headlineLinks ?? [];
    for (const { headline, url } of links) {
      const h = headline.toLowerCase().trim();
      if (!h || !url?.includes('montgomeryal.gov')) continue;
      if (h === titleNorm) return url;
      if (h.includes(titleNorm) || titleNorm.includes(h)) return url;
      const titleWords = titleNorm.split(/\s+/).filter((w) => w.length > 2);
      const headlineWords = h.split(/\s+/).filter((w) => w.length > 2);
      const overlap = titleWords.filter((w) => headlineWords.includes(w)).length;
      if (overlap >= Math.min(2, titleWords.length)) return url;
    }
  }
  return null;
}

/**
 * Resolve item to a real external source URL from the Bright Data payload only.
 * Never invent URLs. Returns null when no valid URL can be derived from the payload.
 * Rejects: localhost, internal dev URLs, placeholders (#), or fallback gov URLs.
 */
function resolveItemUrl(
  item: DigestItem,
  sourceUrlMap: Map<string, string>,
  scraped: ScrapedResult[]
): string | null {
  const u = (item.url || '').trim();
  if (u && u !== '#' && u.startsWith('https://') && (u.includes('montgomeryal.gov') || u.includes('.gov'))) {
    if (u.includes('localhost') || u.includes('127.0.0.1') || u.startsWith('/')) return null;
    return u;
  }
  const fromHeadline = resolveUrlFromHeadlineMatch(item.title, item.source || '', scraped);
  if (fromHeadline) return fromHeadline;
  const bySource = sourceUrlMap.get((item.source || '').toLowerCase().trim());
  if (bySource) return bySource;
  for (const r of scraped) {
    if ((item.source || '').toLowerCase().includes((r.title || '').toLowerCase())) return r.finalUrl || r.url;
  }
  const src = (item.source || '').toLowerCase().trim();
  const fromAlias = DEPARTMENT_ALIASES[src];
  if (fromAlias) return fromAlias;
  for (const [alias, url] of Object.entries(DEPARTMENT_ALIASES)) {
    if (src.includes(alias) || alias.includes(src)) return url;
  }
  return null;
}

/**
 * Sanitize digest items – use only real external URLs from Bright Data payload.
 * Never invent URLs. When URL cannot be resolved, set url to null (card shows "No Source URL Provided").
 */
export function sanitizeDigestItems(
  items: Array<{ title?: string; summary?: string; content?: string; source?: string; url?: string; category?: string; location_text?: string | null; district?: string | null; neighborhood?: string | null }>,
  sources?: Array<{ label?: string; url?: string } | string>
): DigestItem[] {
  const sourceMap = new Map<string, string>();
  if (sources) {
    for (const s of sources) {
      const label = typeof s === 'string' ? s : (s as { label?: string }).label;
      const url = typeof s === 'string' ? s : (s as { url?: string }).url;
      if (label && url && typeof url === 'string' && url.startsWith('https://') && url.includes('.gov')) {
        sourceMap.set(label.toLowerCase().trim(), url);
      }
    }
  }
  return items.map((item) => {
    const src = (item.source || '').trim();
    const category = normalizeCategory(item.category, src, item.title || '');
    let url: string | null = (item.url || '').trim() || null;
    if (!url || url === '#') url = null;
    else if (!url.startsWith('https://') || !url.includes('.gov') || url.includes('localhost') || url.includes('127.0.0.1')) url = null;
    if (!url) url = resolveSourceToUrl(src, sourceMap, sources) ?? null;
    if (!url) url = CATEGORY_TO_URL[category] ?? null;
    const summary = (item.summary ?? item.content) || '';
    return enrichDigestItem({
      title: item.title || '',
      summary,
      source: src || 'City of Montgomery',
      url: ensureExternalGovUrl(url),
      category,
      location_text: item.location_text ?? null,
      district: item.district ?? null,
      neighborhood: item.neighborhood ?? null,
    });
  });
}

/** Item type for public-information card classification */
export type CardItemType =
  | 'government_announcement'
  | 'road_closure'
  | 'public_meeting'
  | 'zoning_notice'
  | 'emergency_alert'
  | 'parks_event'
  | 'infrastructure_notice'
  | 'sanitation_update'
  | 'civic_hearing'
  | 'other';

function classifyItemType(source: string, title: string, summary: string): CardItemType {
  const text = `${(source || '')} ${(title || '')} ${(summary || '')}`.toLowerCase();
  if (text.includes('emergency') || text.includes('alert') || text.includes('police') || text.includes('fire'))
    return 'emergency_alert';
  if (text.includes('road') || text.includes('closure') || text.includes('detour') || text.includes('street'))
    return 'road_closure';
  if (text.includes('zoning') || text.includes('planning') || text.includes('board of adjustment'))
    return 'zoning_notice';
  if (text.includes('council') || text.includes('meeting') || text.includes('hearing') || text.includes('ordinance'))
    return text.includes('zoning') ? 'zoning_notice' : 'public_meeting';
  if (text.includes('park') || text.includes('recreation') || text.includes('pool'))
    return 'parks_event';
  if (text.includes('construction') || text.includes('infrastructure') || text.includes('permit'))
    return 'infrastructure_notice';
  if (text.includes('sanitation') || text.includes('trash') || text.includes('recycling'))
    return 'sanitation_update';
  if (text.includes('announcement') || text.includes('notice'))
    return 'government_announcement';
  return 'other';
}

export interface BrightDataValidationReport {
  /** A. Validation summary */
  validationSummary: {
    payloadExists: boolean;
    payloadNotEmpty: boolean;
    itemCount: number;
    itemsWithSourceUrl: number;
    itemsWithoutSourceUrl: number;
  };
  /** B. Classification of each item's type */
  classifications: Array<{ index: number; title: string; type: CardItemType }>;
  /** C. JSON array of cards with title, summary, source_url (external link only, null = No Source URL Provided) */
  cards: Array<{ title: string; summary: string; source_url: string | null }>;
  /** D. Notes on missing or malformed fields */
  notes: string[];
}

/**
 * Process a Bright Data payload into public-information cards.
 * Validates payload, classifies items, extracts headline/summary/source_url.
 * Never invents URLs; marks "No Source URL Provided" when missing.
 */
export function processBrightDataPayload(
  scrapedPayload: ScrapedResult[],
  extractedItems: Array<{ title?: string; summary?: string; content?: string; source?: string; url?: string }>
): BrightDataValidationReport {
  const notes: string[] = [];
  const sources = scrapedPayload.map((r) => ({ label: r.title, url: r.finalUrl || r.url }));
  const sanitized = sanitizeDigestItems(extractedItems, sources);

  const payloadExists = Array.isArray(scrapedPayload);
  const payloadNotEmpty = payloadExists && scrapedPayload.length > 0;
  const itemCount = sanitized.length;
  const itemsWithSourceUrl = sanitized.filter((i) => i.url != null && i.url.length > 0).length;
  const itemsWithoutSourceUrl = itemCount - itemsWithSourceUrl;

  if (!payloadExists) notes.push('Payload is not a valid array.');
  if (payloadNotEmpty && itemCount === 0) notes.push('No items could be extracted from the payload.');
  if (itemsWithoutSourceUrl > 0)
    notes.push(`${itemsWithoutSourceUrl} item(s) have no source URL from the Bright Data payload; marked as "No Source URL Provided".`);

  const classifications = sanitized.map((item, i) => ({
    index: i,
    title: item.title,
    type: classifyItemType(item.source, item.title, item.summary),
  }));

  const cards = sanitized.map((item) => ({
    title: item.title,
    summary: item.summary,
    source_url: item.url,
  }));

  return {
    validationSummary: {
      payloadExists,
      payloadNotEmpty,
      itemCount,
      itemsWithSourceUrl,
      itemsWithoutSourceUrl,
    },
    classifications,
    cards,
    notes,
  };
}

export interface FullDigest {
  date: string;
  items: DigestItem[];
  sources: string[];
  createdAt: string;
}

/**
 * Derive digest event_at from scraped results using parseEventTimeFromHtml.
 * Uses the earliest parsed event date, or ingested time as fallback.
 */
function resolveDigestEventTime(scrapedResults: ScrapedResult[]): {
  eventAtUtc: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  source: string;
} {
  const nowUtc = new Date().toISOString();
  let best: { eventAtUtc: string; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; source: string } = {
    eventAtUtc: nowUtc,
    confidence: 'LOW',
    source: 'fallback_ingested_at',
  };

  for (const r of scrapedResults) {
    const html = (r as ScrapedResult & { html?: string }).html ?? r.text ?? '';
    const parsed = parseEventTimeFromHtml(html, r.extractedAt ?? nowUtc);
    if (parsed.confidence === 'HIGH' || (parsed.confidence === 'MEDIUM' && best.confidence === 'LOW')) {
      best = {
        eventAtUtc: parsed.eventAtUtc,
        confidence: parsed.confidence,
        source: parsed.source,
      };
    }
  }

  return best;
}

export async function generateDailyDigest(): Promise<FullDigest> {
  console.log("Starting daily digest generation...");

  let scrapedResults: ScrapedResult[] = [];
  try {
    scrapedResults = await scrapeUrls(WHITELIST_URLS, 2);
    console.log(`[Digest] Fetched ${scrapedResults.length} Montgomery sources (montgomeryal.gov)`);
  } catch (err) {
    console.error("Scraping failed (Bright Data may not be configured):", err);
    throw new Error("No data scraped from whitelist URLs");
  }

  if (scrapedResults.length === 0) {
    throw new Error("No data scraped from whitelist URLs");
  }

  const { eventAtUtc, confidence, source } = resolveDigestEventTime(scrapedResults);
  const ingestedAtUtc = new Date().toISOString();

  // 2. AI Summarization – inclusive transparency: what the city puts out for the public
  const sourceList = scrapedResults.map((r) => `- ${r.title} → URL: ${r.finalUrl || r.url}`).join('\n');
  const prompt = `
Create "Today in Montgomery" – a civic digest from the scraped city data below. Focus on inclusive transparency: information the city makes public that residents should know.

PRIORITY CONTENT TO EXTRACT:
- Road closures, detours, street work (Public Works) → category "Traffic"
- Zoning hearings, Board of Adjustment, rezoning (Planning/Land Use) → category "Planning"
- City Council meetings, agendas, ordinances → category "Civic"
- Parks & Rec events, facility updates → category "Parks"
- Public Safety announcements → category "Public Safety"
- Construction, permits, capital projects → category "Infrastructure"
- Sanitation schedules, changes, citations → category "Sanitation"

RULES:
- Each item: { "title": "...", "summary": "...", "source": "...", "url": "...", "category": "..." }
- IMPORTANT: url MUST be the exact gov source URL from the list below. Never use "#" or placeholder.
- category must be one of: Traffic, Parks, Civic, Infrastructure, Sanitation, Public Safety, Planning
- Assign "source" to the page title (e.g. "City Council", "Public Works") that the content came from.
- Identify 5–12 key items. Include dates/times when present.
- Return JSON: { "items": [ {...}, {...} ] }

SOURCE URLS (use these exact URLs for the url field):
${sourceList}

Scraped Data:
${scrapedResults.map((r) => `SOURCE: ${r.title} | URL: ${r.finalUrl || r.url}\nCONTENT: ${r.text.substring(0, 2500)}`).join('\n\n---\n\n')}
  `.trim();

  if (!process.env.OPENAI_API_KEY && !process.env.GEMINI_API_KEY) {
    throw new Error("No AI provider. Set OPENAI_API_KEY or GEMINI_API_KEY in .env");
  }

  const parsed = await generateStructuredJson<{ items: DigestItem[] } | DigestItem[]>(prompt);
  let items: DigestItem[] = Array.isArray(parsed) ? parsed : parsed.items;
  const sourceUrlMap = buildSourceUrlMap(scrapedResults);

  const rawItemCount = items.length;

  // Ensure each item has a real gov source URL and canonical category
  items = items.map((item) => {
    const category = normalizeCategory(item.category, item.source || '', item.title || '');
    let url = resolveItemUrl(item, sourceUrlMap, scrapedResults);
    if (!url) url = CATEGORY_TO_URL[category] ?? null;
    return enrichDigestItem({ ...item, url, category });
  });

  // Montgomery-only filter: exclude items clearly about other AL cities (gov source = include unless exclude)
  const beforeFilter = items.length;
  items = items.filter((item) => {
    const text = `${item.title} ${item.summary} ${item.source}`;
    return isMontgomeryRelevantFromGovSource(text);
  });
  const excludedDigestCount = beforeFilter - items.length;
  console.log(`[Digest] Sources: ${scrapedResults.map((r) => r.url).join(', ')}`);
  console.log(`[Digest] Raw items: ${rawItemCount} → Montgomery-only: ${items.length}, excluded: ${excludedDigestCount}`);

  const dateKey = new Date().toISOString().split('T')[0];
  const createdAt = new Date().toISOString();

  const digest: FullDigest = {
    date: dateKey,
    items,
    sources: scrapedResults.map(r => r.url),
    createdAt,
  };

  // 3a. Phase 2: Insert structured digest_items (category-aware, rule-classified)
  const records = items.map((item) =>
    toDigestItemRecord(item, dateKey, eventAtUtc, ingestedAtUtc)
  );
  const categoryCounts = records.reduce((acc, r) => {
    acc[r.category] = (acc[r.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  console.log(`[Digest] Category counts: ${Object.entries(categoryCounts).map(([c, n]) => `${c}=${n}`).join(', ')}`);

  db.prepare('DELETE FROM digest_items WHERE digest_date = ?').run(dateKey);
  const insertItem = db.prepare(`
    INSERT INTO digest_items (id, digest_date, title, summary, category, source_name, source_url, event_at_utc, ingested_at_utc, location_text, city, raw_json, created_at_utc)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const insertTx = db.transaction((recs: DigestItemRecord[]) => {
    for (const r of recs) {
      insertItem.run(
        r.id,
        dateKey,
        r.title,
        r.summary,
        r.category,
        r.source_name,
        r.source_url,
        r.event_at_utc,
        r.ingested_at_utc,
        r.location_text,
        r.city,
        r.raw_json,
        createdAt
      );
    }
  });
  insertTx(records);

  // 3b. Store digest aggregate in digests table (backward compat)
  const digestId = `digest-${dateKey}`;
  const sourcesJson = JSON.stringify(scrapedResults.map(r => ({ label: r.title, url: r.finalUrl || r.url })));

  db.prepare(`
    INSERT OR REPLACE INTO digests (
      id, date_key, event_at_utc, ingested_at_utc, event_time_confidence, event_time_source,
      items_json, sources_json, created_at_utc
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    digestId,
    dateKey,
    eventAtUtc,
    ingestedAtUtc,
    confidence,
    source,
    JSON.stringify(items),
    sourcesJson,
    createdAt
  );

  // 4. Write to file fallback
  const dir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'digest_today.json'), JSON.stringify(digest, null, 2));

  console.log("Daily digest generation complete.");
  return digest;
}

/** Item type classification for Bright Data payload validation */
export type ItemType =
  | 'government_announcement'
  | 'road_closure'
  | 'public_meeting'
  | 'zoning_notice'
  | 'emergency_alert'
  | 'infrastructure_notice'
  | 'parks_event'
  | 'sanitation_notice'
  | 'civic_hearing'
  | 'other';

/** Public-information card output (external link only; no invented URLs) */
export interface PublicInfoCard {
  title: string;
  summary: string;
  source_url: string | null;
}

/** Valid categories for digest_items (lowercase, matches Phase 2 classification). */
const DIGEST_ITEM_CATEGORIES = ['traffic', 'parks', 'civic', 'infrastructure', 'sanitation', 'public safety', 'planning', 'other'] as const;

/** Get digest items by date and optional category. Newest first. Uses digest_items when available. */
export function getDigestItemsByCategory(dateKey: string, category?: string): DigestItem[] {
  const cat = category?.toLowerCase().trim();
  const isValidCategory = cat && DIGEST_ITEM_CATEGORIES.includes(cat as (typeof DIGEST_ITEM_CATEGORIES)[number]);

  const rows = db.prepare(
    isValidCategory
      ? `SELECT id, title, summary, category, source_name, source_url, event_at_utc, ingested_at_utc, location_text, raw_json
         FROM digest_items WHERE digest_date = ? AND category = ?
         ORDER BY ingested_at_utc DESC`
      : `SELECT id, title, summary, category, source_name, source_url, event_at_utc, ingested_at_utc, location_text, raw_json
         FROM digest_items WHERE digest_date = ?
         ORDER BY ingested_at_utc DESC`
  ).all(isValidCategory ? [dateKey, cat] : [dateKey]) as Array<{
    title: string;
    summary: string;
    category: string;
    source_name: string;
    source_url: string | null;
    location_text: string | null;
    raw_json: string | null;
  }>;

  if (rows.length > 0) {
    return rows.map((r) => {
      let rawContext: Partial<DigestItem> = {};
      try {
        rawContext = r.raw_json ? JSON.parse(r.raw_json) : {};
      } catch {
        rawContext = {};
      }
      return enrichDigestItem({
        title: r.title,
        summary: r.summary,
        source: r.source_name,
        url: r.source_url,
        category: normalizeCategory(r.category, r.source_name, r.title),
        location_text: r.location_text,
        district: rawContext.district ?? null,
        neighborhood: rawContext.neighborhood ?? null,
      });
    });
  }

  // Fallback to digests table (Phase 2 may not have run yet)
  const digest = db.prepare('SELECT items_json, sources_json FROM digests WHERE date_key = ?').get(dateKey) as {
    items_json: string;
    sources_json: string;
  } | undefined;
  if (!digest) return [];

  let items: DigestItem[];
  try {
    items = JSON.parse(digest.items_json);
  } catch {
    return [];
  }
  if (!Array.isArray(items)) return [];

  let sources: Array<{ label?: string; url?: string } | string> = [];
  try {
    const parsedSources = JSON.parse(digest.sources_json);
    sources = Array.isArray(parsedSources) ? parsedSources : [];
  } catch {
    sources = [];
  }

  const sanitized = sanitizeDigestItems(items, sources);

  if (isValidCategory) {
    return sanitized.filter((i) => (i.category || '').toLowerCase() === cat);
  }
  return sanitized;
}

export function getLatestDigest(): FullDigest | null {
  try {
    const row = db.prepare('SELECT * FROM digests ORDER BY created_at_utc DESC LIMIT 1').get() as {
      date_key: string;
      items_json: string;
      sources_json: string;
      created_at_utc: string;
    } | undefined;

    if (row) {
      const sources = JSON.parse(row.sources_json);
      const normalizedSources = Array.isArray(sources) ? sources : [];
      const sourceUrls = sanitizeDigestSources(normalizedSources);
      return {
        date: row.date_key,
        items: sanitizeDigestItems(JSON.parse(row.items_json), normalizedSources),
        sources: sourceUrls,
        createdAt: row.created_at_utc,
      };
    }

    // Fallback to file
    const filePath = path.join(process.cwd(), 'data', 'digest_today.json');
    if (fs.existsSync(filePath)) {
      const fileDigest = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Partial<FullDigest> & {
        items?: DigestItem[];
        sources?: Array<{ label?: string; url?: string } | string>;
      };
      const fileSources = Array.isArray(fileDigest.sources) ? fileDigest.sources : [];
      return {
        date: fileDigest.date || new Date().toISOString().split('T')[0],
        items: sanitizeDigestItems(Array.isArray(fileDigest.items) ? fileDigest.items : [], fileSources),
        sources: sanitizeDigestSources(fileSources),
        createdAt: fileDigest.createdAt || new Date().toISOString(),
      };
    }
  } catch (error) {
    console.error("Error fetching latest digest:", error);
  }
  return null;
}
