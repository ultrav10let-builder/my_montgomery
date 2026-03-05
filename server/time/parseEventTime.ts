import { parseISO, formatISO, isValid, parse } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface ParsedTimeResult {
  eventAtUtc: string;
  ingestedAtUtc: string;
  confidence: Confidence;
  source: string;
  raw?: string;
}

const CITY_TZ = 'America/Chicago';

/**
 * Coerces a string into a Date object by trying common formats.
 */
export function coerceDateFromKnownFormats(input: string): Date | null {
  if (!input) return null;

  // Try ISO first
  const isoDate = parseISO(input);
  if (isValid(isoDate)) return isoDate;

  // Try common formats
  const formats = [
    'MM/dd/yyyy',
    'MM/dd/yyyy HH:mm:ss',
    'yyyy-MM-dd',
    'yyyy-MM-dd HH:mm:ss',
    'MMM d, yyyy',
    'MMMM d, yyyy',
    'MMMM d, yyyy h:mm a',
    'MMM d, yyyy h:mm a',
  ];

  for (const fmt of formats) {
    try {
      const parsed = parse(input, fmt, new Date());
      if (isValid(parsed)) return parsed;
    } catch (e) {
      // continue
    }
  }

  // Try native Date constructor as last resort
  const nativeDate = new Date(input);
  if (isValid(nativeDate)) return nativeDate;

  return null;
}

/**
 * Normalizes a date input to a UTC ISO string.
 * If input is date-only, assumes local city timezone at 12:00 noon.
 */
export function normalizeToUtc(input: string | number | Date, assumedTz: string = CITY_TZ): string | null {
  if (!input) return null;

  let date: Date | null = null;

  if (typeof input === 'string') {
    // Check if it's just a date YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
      // Assume 12:00 noon in city timezone
      const localDateTime = `${input} 12:00:00`;
      date = fromZonedTime(localDateTime, assumedTz);
    } else {
      date = coerceDateFromKnownFormats(input);
      // If the string didn't have a timezone offset, assume it's local
      if (date && !input.includes('Z') && !/[+-]\d{2}:?\d{2}$/.test(input)) {
        date = fromZonedTime(date, assumedTz);
      }
    }
  } else if (typeof input === 'number') {
    date = new Date(input);
  } else {
    date = input;
  }

  if (date && isValid(date)) {
    return date.toISOString();
  }

  return null;
}

/**
 * Parses event time from Open Data records based on field priority.
 */
export function parseEventTimeFromOpenData(record: any, fieldPriority: string[]): ParsedTimeResult {
  const ingestedAtUtc = new Date().toISOString();
  
  for (const field of fieldPriority) {
    const value = record[field];
    if (value) {
      const eventAtUtc = normalizeToUtc(value);
      if (eventAtUtc) {
        // Check if it was a date-only string for confidence
        const isDateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
        return {
          eventAtUtc,
          ingestedAtUtc,
          confidence: isDateOnly ? 'MEDIUM' : 'HIGH',
          source: `opendata_field:${field}`,
          raw: String(value)
        };
      }
    }
  }

  return {
    eventAtUtc: ingestedAtUtc,
    ingestedAtUtc,
    confidence: 'LOW',
    source: 'fallback_ingested_at'
  };
}

/**
 * Parses event time from HTML content using common metadata patterns.
 */
export function parseEventTimeFromHtml(html: string, fallbackIngestedAtUtc: string): ParsedTimeResult {
  // 1. JSON-LD
  const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (jsonLdMatch) {
    try {
      const data = JSON.parse(jsonLdMatch[1]);
      const dateVal = data.datePublished || data.dateModified || data.uploadDate;
      if (dateVal) {
        const utc = normalizeToUtc(dateVal);
        if (utc) return { eventAtUtc: utc, ingestedAtUtc: fallbackIngestedAtUtc, confidence: 'HIGH', source: 'html_jsonld', raw: dateVal };
      }
    } catch (e) {}
  }

  // 2. Meta tags
  const metaPatterns = [
    /property="article:published_time" content="([^"]+)"/,
    /name="pubdate" content="([^"]+)"/,
    /name="publish-date" content="([^"]+)"/,
    /property="og:updated_time" content="([^"]+)"/
  ];

  for (const pattern of metaPatterns) {
    const match = html.match(pattern);
    if (match) {
      const utc = normalizeToUtc(match[1]);
      if (utc) return { eventAtUtc: utc, ingestedAtUtc: fallbackIngestedAtUtc, confidence: 'HIGH', source: 'html_meta', raw: match[1] };
    }
  }

  // 3. <time> tags
  const timeMatch = html.match(/<time[^>]*datetime="([^"]+)"/);
  if (timeMatch) {
    const utc = normalizeToUtc(timeMatch[1]);
    if (utc) return { eventAtUtc: utc, ingestedAtUtc: fallbackIngestedAtUtc, confidence: 'HIGH', source: 'html_time_tag', raw: timeMatch[1] };
  }

  // 4. Visible text patterns
  const textPatterns = [
    /Published:\s*([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/i,
    /Last updated\s*(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /Posted on\s*([A-Z][a-z.]+\s+\d{1,2},\s+\d{4})/i
  ];

  for (const pattern of textPatterns) {
    const match = html.match(pattern);
    if (match) {
      const utc = normalizeToUtc(match[1]);
      if (utc) return { eventAtUtc: utc, ingestedAtUtc: fallbackIngestedAtUtc, confidence: 'MEDIUM', source: 'html_text_pattern', raw: match[1] };
    }
  }

  return {
    eventAtUtc: fallbackIngestedAtUtc,
    ingestedAtUtc: fallbackIngestedAtUtc,
    confidence: 'LOW',
    source: 'fallback_ingested_at'
  };
}
