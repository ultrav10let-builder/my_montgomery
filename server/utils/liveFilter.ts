/**
 * Live mode lifecycle rules.
 *
 * The app's "live" view should behave more like a lightweight calendar / interval
 * system than a single blunt recency window:
 * - short-lived traffic incidents clear quickly
 * - construction / closures persist longer
 * - scheduled / civic events honor explicit end dates when available
 * - unresolved service-style signals stay visible for a bounded window
 */

type JsonRecord = Record<string, unknown>;

export type SignalLifecycleInput = {
  category?: string | null;
  raw_json?: string | null;
  event_at_utc?: string | null;
  ingested_at_utc?: string | null;
  created_at_utc?: string | null;
};

export type TrafficFeedLifecycleInput = {
  description?: string | null;
  severity?: string | null;
  source_label?: string | null;
  road?: string | null;
  raw_json?: string | null;
  ingested_at_utc?: string | null;
  created_at_utc?: string | null;
};

export type LifecyclePolicyKey =
  | 'traffic-incident'
  | 'traffic-roadwork'
  | 'planned-event'
  | 'service-request'
  | 'default';

export type EventLifecycle = {
  policyKey: LifecyclePolicyKey;
  startsAtUtc: string | null;
  endsAtUtc: string | null;
  expiresAtUtc: string | null;
  isActive: boolean;
  reason: string;
  activeWindowHours: number;
  retentionWindowHours: number;
};

type LifecyclePolicy = {
  activeWindowHours: number;
  retentionWindowHours: number;
};

/** Status values that indicate a signal/request is resolved or closed. */
const RESOLVED_STATUSES = new Set([
  'closed', 'resolved', 'completed', 'done', 'cancelled', 'canceled',
  'archived', 'expired', 'inactive', 'cleared',
]);

const HOURS = {
  trafficIncident: 6,
  trafficRoadwork: 24 * 14,
  plannedEvent: 24 * 3,
  serviceRequest: 24 * 7,
  default: 24 * 3,
  retentionBuffer: 24 * 7,
} as const;

const POLICY_BY_KEY: Record<LifecyclePolicyKey, LifecyclePolicy> = {
  'traffic-incident': {
    activeWindowHours: HOURS.trafficIncident,
    retentionWindowHours: HOURS.trafficIncident + 24,
  },
  'traffic-roadwork': {
    activeWindowHours: HOURS.trafficRoadwork,
    retentionWindowHours: HOURS.trafficRoadwork + HOURS.retentionBuffer,
  },
  'planned-event': {
    activeWindowHours: HOURS.plannedEvent,
    retentionWindowHours: HOURS.plannedEvent + 24 * 4,
  },
  'service-request': {
    activeWindowHours: HOURS.serviceRequest,
    retentionWindowHours: HOURS.serviceRequest + HOURS.retentionBuffer,
  },
  default: {
    activeWindowHours: HOURS.default,
    retentionWindowHours: HOURS.default + 24 * 4,
  },
};

const TRAFFIC_INCIDENT_PATTERNS = [
  /\b(accident|crash|collision|disabled vehicle|stalled vehicle|incident|delay|congestion|backup|hazmat)\b/i,
];

const TRAFFIC_ROADWORK_PATTERNS = [
  /\b(construction|roadwork|maintenance|repair|repairs|resurfacing|paving|bridge work|bridge repair|utility work|work zone|lane closure|road closure|detour)\b/i,
];

const PLANNED_EVENT_PATTERNS = [
  /\b(event|festival|parade|concert|meeting|ceremony|celebration|scheduled|upcoming|weekend)\b/i,
];

const SERVICE_CATEGORY_PATTERNS = [
  /\b(infrastructure|sanitation|public safety|service request|utilities|code enforcement|civic)\b/i,
];

const START_DATE_KEYS = [
  'START_DATE', 'start_date', 'startDate', 'START_AT', 'start_at', 'startAt',
  'BEGIN_DATE', 'begin_date', 'beginDate', 'EVENT_START', 'event_start', 'eventStart',
];

const END_DATE_KEYS = [
  'END_DATE', 'end_date', 'endDate', 'END_AT', 'end_at', 'endAt',
  'EXPIRATION_DATE', 'expiration_date', 'expires_at', 'expiresAt',
  'EVENT_END', 'event_end', 'eventEnd',
];

const CLOSED_DATE_KEYS = [
  'CLOSED_AT', 'closed_at', 'closedAt', 'COMPLETED_DATE', 'completed_date', 'completedDate',
  'RESOLVED_AT', 'resolved_at', 'resolvedAt',
];

const TEXT_KEYS = [
  'DESCRIPTION', 'description', 'SUMMARY', 'summary', 'DETAILS', 'details',
  'TITLE', 'title', 'NAME', 'name', 'TYPE', 'type',
];

/** Legacy default for short-lived traffic incidents in live mode. */
export const LIVE_TRAFFIC_MAX_AGE_HOURS = HOURS.trafficIncident;

/** Max horizon to keep traffic feed rows in local storage so long-lived closures survive refresh cycles. */
export const MAX_TRAFFIC_RETENTION_HOURS = POLICY_BY_KEY['traffic-roadwork'].retentionWindowHours;

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function safeParseRawJson(rawJson: string | null | undefined): JsonRecord | null {
  if (!rawJson || typeof rawJson !== 'string') return null;
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    return parsed && typeof parsed === 'object' ? (parsed as JsonRecord) : null;
  } catch {
    return null;
  }
}

function getContainers(rawJson: string | null | undefined): JsonRecord[] {
  const parsed = safeParseRawJson(rawJson);
  if (!parsed) return [];
  const attributes = parsed.attributes;
  const properties = parsed.properties;
  return [
    parsed,
    attributes && typeof attributes === 'object' ? (attributes as JsonRecord) : null,
    properties && typeof properties === 'object' ? (properties as JsonRecord) : null,
  ].filter((value): value is JsonRecord => Boolean(value));
}

function getFirstDefined(containers: JsonRecord[], keys: string[]): unknown {
  for (const container of containers) {
    for (const key of keys) {
      if (container[key] != null) return container[key];
    }
  }
  return undefined;
}

function parseDateValue(value: unknown): Date | null {
  if (value == null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'number') {
    const millis = value > 1e12 ? value : value * 1000;
    const parsed = new Date(millis);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const text = normalizeText(value);
  if (!text) return null;
  const parsedMillis = Date.parse(text);
  if (Number.isNaN(parsedMillis)) return null;
  return new Date(parsedMillis);
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function extractLifecycleText(containers: JsonRecord[], extraParts: Array<string | null | undefined>): string {
  const rawParts = [
    ...extraParts,
    ...TEXT_KEYS.map((key) => normalizeText(getFirstDefined(containers, [key]))),
  ];
  return rawParts.filter(Boolean).join(' ').toLowerCase();
}

function resolvePolicyKey(category: string | null | undefined, text: string): LifecyclePolicyKey {
  const categoryText = normalizeText(category).toLowerCase();
  const combined = `${categoryText} ${text}`.trim();

  if (
    TRAFFIC_ROADWORK_PATTERNS.some((pattern) => pattern.test(combined)) ||
    /\b(road closure|roadway|street closure)\b/i.test(categoryText)
  ) {
    return 'traffic-roadwork';
  }
  if (
    TRAFFIC_INCIDENT_PATTERNS.some((pattern) => pattern.test(combined)) ||
    /\btraffic\b/i.test(categoryText)
  ) {
    return 'traffic-incident';
  }
  if (
    PLANNED_EVENT_PATTERNS.some((pattern) => pattern.test(combined)) ||
    /\b(planning|parks|recreation|special event)\b/i.test(categoryText)
  ) {
    return 'planned-event';
  }
  if (SERVICE_CATEGORY_PATTERNS.some((pattern) => pattern.test(combined))) {
    return 'service-request';
  }
  return 'default';
}

function deriveLifecycle(
  input: {
    category?: string | null;
    raw_json?: string | null;
    event_at_utc?: string | null;
    ingested_at_utc?: string | null;
    created_at_utc?: string | null;
    description?: string | null;
    severity?: string | null;
    source_label?: string | null;
    road?: string | null;
  },
  now: Date = new Date(),
): EventLifecycle {
  const containers = getContainers(input.raw_json);
  const explicitEnd =
    parseDateValue(getFirstDefined(containers, END_DATE_KEYS)) ??
    parseDateValue(getFirstDefined(containers, CLOSED_DATE_KEYS));
  const explicitStart = parseDateValue(getFirstDefined(containers, START_DATE_KEYS));
  const fallbackStart =
    parseDateValue(input.event_at_utc) ??
    parseDateValue(input.ingested_at_utc) ??
    parseDateValue(input.created_at_utc);
  const startsAt = explicitStart ?? fallbackStart;
  const text = extractLifecycleText(containers, [
    input.category,
    input.description,
    input.road,
    input.source_label,
    input.severity,
  ]);
  const policyKey = resolvePolicyKey(input.category, text);
  const policy = POLICY_BY_KEY[policyKey];

  if (!startsAt) {
    return {
      policyKey,
      startsAtUtc: null,
      endsAtUtc: explicitEnd?.toISOString() ?? null,
      expiresAtUtc: null,
      isActive: false,
      reason: 'missing_start_time',
      activeWindowHours: policy.activeWindowHours,
      retentionWindowHours: policy.retentionWindowHours,
    };
  }

  if (isSignalResolved(input.raw_json)) {
    return {
      policyKey,
      startsAtUtc: startsAt.toISOString(),
      endsAtUtc: explicitEnd?.toISOString() ?? null,
      expiresAtUtc: explicitEnd?.toISOString() ?? null,
      isActive: false,
      reason: 'resolved',
      activeWindowHours: policy.activeWindowHours,
      retentionWindowHours: policy.retentionWindowHours,
    };
  }

  const expiresAt = explicitEnd ?? addHours(startsAt, policy.activeWindowHours);
  const isActive = now.getTime() >= startsAt.getTime() && now.getTime() <= expiresAt.getTime();

  return {
    policyKey,
    startsAtUtc: startsAt.toISOString(),
    endsAtUtc: explicitEnd?.toISOString() ?? null,
    expiresAtUtc: expiresAt.toISOString(),
    isActive,
    reason: explicitEnd ? 'explicit_end_window' : 'policy_window',
    activeWindowHours: policy.activeWindowHours,
    retentionWindowHours: policy.retentionWindowHours,
  };
}

/**
 * Returns true if the signal appears resolved/closed based on raw_json.
 * Checks attributes.STATUS, attributes.STATE, status; and closed_at/CLOSED_AT.
 */
export function isSignalResolved(rawJson: string | null | undefined): boolean {
  const containers = getContainers(rawJson);
  if (containers.length === 0) return false;
  const status = normalizeText(getFirstDefined(containers, ['STATUS', 'STATE', 'status', 'state'])).toLowerCase();
  if (status && RESOLVED_STATUSES.has(status)) return true;
  const closedAt = parseDateValue(getFirstDefined(containers, CLOSED_DATE_KEYS));
  return Boolean(closedAt);
}

export function deriveSignalLifecycle(signal: SignalLifecycleInput, now: Date = new Date()): EventLifecycle {
  return deriveLifecycle(signal, now);
}

export function deriveTrafficFeedLifecycle(feed: TrafficFeedLifecycleInput, now: Date = new Date()): EventLifecycle {
  return deriveLifecycle(feed, now);
}

export function isSignalActive(signal: SignalLifecycleInput, now: Date = new Date()): boolean {
  return deriveSignalLifecycle(signal, now).isActive;
}

export function isTrafficFeedActive(feed: TrafficFeedLifecycleInput, now: Date = new Date()): boolean {
  return deriveTrafficFeedLifecycle(feed, now).isActive;
}

/** Returns true if the feed is too old for short-lived live incident mode. */
export function isTrafficFeedExpired(ingestedAtUtc: string, maxAgeHours: number = LIVE_TRAFFIC_MAX_AGE_HOURS): boolean {
  const ingested = parseDateValue(ingestedAtUtc);
  if (!ingested) return true;
  const cutoff = addHours(ingested, maxAgeHours);
  return cutoff.getTime() < Date.now();
}
