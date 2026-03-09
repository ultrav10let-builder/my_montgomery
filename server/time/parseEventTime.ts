/**
 * Time Normalization Module
 *
 * Canonical fields for every record:
 * - event_at_utc (ISO 8601 UTC): when the city says it happened
 * - ingested_at_utc (ISO 8601 UTC): when we fetched it
 * - event_time_confidence: HIGH | MEDIUM | LOW
 * - event_time_source: which field or parsing method produced event_at
 *
 * See docs/TIME_NORMALIZATION.md for full specification.
 */

import { parseISO, isValid, parse } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

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
 * Coerces a string into a Date object by trying many common formats.
 * Supports: ISO, MM/dd/yyyy, yyyy-MM-dd, "March 5, 2026", "Mar. 5, 2026", etc.
 */
export function coerceDateFromKnownFormats(input: string): Date | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // ISO 8601 first
  const isoDate = parseISO(trimmed);
  if (isValid(isoDate)) return isoDate;

  const formats = [
    'yyyy-MM-dd',
    'yyyy-MM-dd HH:mm:ss',
    'yyyy-MM-dd\'T\'HH:mm:ss',
    'yyyy-MM-dd\'T\'HH:mm:ss.SSS',
    'yyyy-MM-dd\'T\'HH:mm:ssXXX',
    'MM/dd/yyyy',
    'MM/dd/yyyy HH:mm:ss',
    'M/d/yyyy',
    'M/d/yyyy H:mm',
    'MMM d, yyyy',
    'MMM. d, yyyy',
    'MMMM d, yyyy',
    'MMM d, yyyy h:mm a',
    'MMMM d, yyyy h:mm a',
    'MMM d, yyyy HH:mm',
    'd MMM yyyy',
    'd MMMM yyyy',
    'yyyy/MM/dd',
  ];

  for (const fmt of formats) {
    try {
      const parsed = parse(trimmed, fmt, new Date());
      if (isValid(parsed)) return parsed;
    } catch {
      // continue
    }
  }

  // Regex patterns for unstructured text
  const patterns = [
    /Published:\s*([A-Za-z]+\.?\s+\d{1,2},?\s+\d{4})/i,
    /Last updated\s+(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /Posted on\s+([A-Za-z]+\.?\s+\d{1,2},?\s+\d{4})/i,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
    /(\d{4}-\d{2}-\d{2})/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) {
      const dateStr = match[1].trim();
      const parsed = coerceDateFromKnownFormats(dateStr);
      if (parsed) return parsed;
    }
  }

  const nativeDate = new Date(trimmed);
  if (isValid(nativeDate)) return nativeDate;

  return null;
}

/**
 * Normalizes a date input to a UTC ISO string.
 * If input is date-only (YYYY-MM-DD), assumes city timezone at 12:00 noon to avoid DST edge issues.
 * If input has timezone offset, respects it.
 */
export function normalizeToUtc(
  input: string | number | Date,
  assumedTz: string = CITY_TZ
): string | null {
  if (input === null || input === undefined) return null;

  let date: Date | null = null;

  if (typeof input === 'number') {
    date = new Date(input);
  } else if (input instanceof Date) {
    date = input;
  } else if (typeof input === 'string') {
    const str = input.trim();
    if (!str) return null;
    // Date-only: assume 12:00 noon in city timezone to avoid DST edge issues
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      try {
        const noonLocal = parse(`${str} 12:00:00`, 'yyyy-MM-dd HH:mm:ss', new Date());
        date = fromZonedTime(noonLocal, assumedTz);
      } catch {
        date = coerceDateFromKnownFormats(str);
      }
    } else {
      date = coerceDateFromKnownFormats(str);
      if (date && !str.includes('Z') && !/[+-]\d{2}:?\d{2}$/.test(str)) {
        try {
          date = fromZonedTime(date, assumedTz);
        } catch {
          // keep date as-is if fromZonedTime fails
        }
      }
    }
  }

  if (date && isValid(date)) return date.toISOString();
  return null;
}

/**
 * Parses event time from Open Data records using a prioritized list of candidate date fields.
 * Each connector provides its own field priority per dataset.
 */
export function parseEventTimeFromOpenData(
  record: Record<string, unknown>,
  fieldPriority: string[]
): ParsedTimeResult {
  const ingestedAtUtc = new Date().toISOString();

  for (const field of fieldPriority) {
    const value = record[field];
    if (value !== null && value !== undefined && value !== '') {
      const strVal = typeof value === 'number' ? String(value) : String(value);
      const eventAtUtc = normalizeToUtc(strVal);
      if (eventAtUtc) {
        const isDateOnly = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim());
        const isGenericField = ['date', 'datetime', 'timestamp'].includes(field.toLowerCase());
        const confidence: Confidence = isDateOnly || isGenericField ? 'MEDIUM' : 'HIGH';
        return {
          eventAtUtc,
          ingestedAtUtc,
          confidence,
          source: `opendata_field:${field}`,
          raw: strVal,
        };
      }
    }
  }

  return {
    eventAtUtc: ingestedAtUtc,
    ingestedAtUtc,
    confidence: 'LOW',
    source: 'fallback_ingested_at',
  };
}

/**
 * Parses event time from HTML content (Bright Data / scraped pages).
 * Attempts in order: JSON-LD, meta tags, <time datetime>, visible text patterns.
 */
export function parseEventTimeFromHtml(
  html: string,
  fallbackIngestedAtUtc: string
): ParsedTimeResult {
  if (!html || typeof html !== 'string') {
    return {
      eventAtUtc: fallbackIngestedAtUtc,
      ingestedAtUtc: fallbackIngestedAtUtc,
      confidence: 'LOW',
      source: 'fallback_ingested_at',
    };
  }

  // 1. JSON-LD schema (may be array or single object)
  const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const m of jsonLdMatches) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        const dateVal = item.datePublished ?? item.dateModified ?? item.uploadDate ?? item.dateCreated;
        if (dateVal) {
          const utc = normalizeToUtc(dateVal);
          if (utc) {
            return {
              eventAtUtc: utc,
              ingestedAtUtc: fallbackIngestedAtUtc,
              confidence: 'HIGH',
              source: 'html_jsonld',
              raw: String(dateVal),
            };
          }
        }
      }
    } catch {
      // continue
    }
  }

  // 2. Meta tags
  const metaPatterns = [
    /property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i,
    /content=["']([^"']+)["'][^>]*property=["']article:published_time["']/i,
    /name=["']pubdate["'][^>]*content=["']([^"']+)["']/i,
    /name=["']publish-date["'][^>]*content=["']([^"']+)["']/i,
    /property=["']og:updated_time["'][^>]*content=["']([^"']+)["']/i,
  ];

  for (const pattern of metaPatterns) {
    const match = html.match(pattern);
    if (match) {
      const utc = normalizeToUtc(match[1].trim());
      if (utc) {
        return {
          eventAtUtc: utc,
          ingestedAtUtc: fallbackIngestedAtUtc,
          confidence: 'HIGH',
          source: 'html_meta',
          raw: match[1],
        };
      }
    }
  }

  // 3. <time datetime="..."> tag
  const timeMatch = html.match(/<time[^>]*datetime=["']([^"']+)["']/i);
  if (timeMatch) {
    const utc = normalizeToUtc(timeMatch[1].trim());
    if (utc) {
      return {
        eventAtUtc: utc,
        ingestedAtUtc: fallbackIngestedAtUtc,
        confidence: 'HIGH',
        source: 'html_time_tag',
        raw: timeMatch[1],
      };
    }
  }

  // 4. Visible text patterns
  const textPatterns = [
    /Published:\s*([A-Za-z]+\.?\s+\d{1,2},?\s+\d{4}(?:\s+\d{1,2}:\d{2}(?:\s*[ap]m)?)?)/i,
    /Last updated\s*[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /Posted on\s*([A-Za-z]+\.?\s+\d{1,2},?\s+\d{4})/i,
    /Posted\s*[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i,
    /(\w+\s+\d{1,2},?\s+\d{4})\s*[-–—]/,
    /(\d{1,2}\/\d{1,2}\/\d{4})/,
  ];

  for (const pattern of textPatterns) {
    const match = html.match(pattern);
    if (match) {
      const utc = normalizeToUtc(match[1].trim());
      if (utc) {
        return {
          eventAtUtc: utc,
          ingestedAtUtc: fallbackIngestedAtUtc,
          confidence: 'MEDIUM',
          source: 'html_text_pattern',
          raw: match[1],
        };
      }
    }
  }

  return {
    eventAtUtc: fallbackIngestedAtUtc,
    ingestedAtUtc: fallbackIngestedAtUtc,
    confidence: 'LOW',
    source: 'fallback_ingested_at',
  };
}
