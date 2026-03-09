/**
 * Historical API Routes
 *
 * GET /api/signals - Query by date range (local YYYY-MM-DD), category, neighborhood
 * GET /api/trends - Compare last N days vs prior N days (event_at_utc based)
 * GET /api/digest - Load digest for a specific date_key
 *
 * All dates use America/Chicago for local boundaries; event_at_utc stored in UTC.
 */

import express from 'express';
import { z } from 'zod';
import Database from 'better-sqlite3';
import { ensureExternalGovUrl, getDigestItemsByCategory } from '../services/digestService';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { subDays, startOfDay, endOfDay, parseISO, format, differenceInCalendarDays } from 'date-fns';
import { isSignalActive } from '../utils/liveFilter';
import { hydrateSignals } from '../utils/signalHydration';

const router = express.Router();

const DATE_YYYY_MM_DD = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

const signalsQuerySchema = z.object({
  start: DATE_YYYY_MM_DD,
  end: DATE_YYYY_MM_DD,
  category: z.string().optional(),
  neighborhood: z.string().optional(),
  /** When true (live mode), exclude resolved/closed events. */
  active_only: z.enum(['1', 'true']).optional(),
});

const trendsQuerySchema = z.object({
  window: z.enum(['7d', '30d', '90d']).optional(),
  start: DATE_YYYY_MM_DD.optional(),
  end: DATE_YYYY_MM_DD.optional(),
}).superRefine((data, ctx) => {
  const hasStart = Boolean(data.start);
  const hasEnd = Boolean(data.end);
  if (hasStart !== hasEnd) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide both start and end for a custom trend range',
      path: hasStart ? ['end'] : ['start'],
    });
  }
});

const digestQuerySchema = z.object({
  date: DATE_YYYY_MM_DD.optional(),
  category: z.string().optional(),
});

/** Montgomery city population (Census July 2024) for per-capita metrics */
const MONTGOMERY_POPULATION = 195818;

const dbPath = process.env.SQLITE_PATH || './data/cache.sqlite';
const db = new Database(dbPath);

const CITY_TZ = 'America/Chicago';

function getUtcDayBounds(localDate: string): { startUtc: string; endUtc: string } {
  const local = parseISO(localDate);
  return {
    startUtc: fromZonedTime(startOfDay(local), CITY_TZ).toISOString(),
    endUtc: fromZonedTime(endOfDay(local), CITY_TZ).toISOString(),
  };
}

function buildTrendWindows(params: { window?: '7d' | '30d' | '90d'; start?: string; end?: string }) {
  if (params.start && params.end) {
    const startDate = parseISO(params.start);
    const endDate = parseISO(params.end);
    const spanDays = differenceInCalendarDays(endDate, startDate) + 1;
    const previousEnd = format(subDays(startDate, 1), 'yyyy-MM-dd');
    const previousStart = format(subDays(startDate, Math.max(spanDays, 1)), 'yyyy-MM-dd');

    return {
      current: {
        start: params.start,
        end: params.end,
        ...getUtcDayBounds(params.start),
        endUtc: getUtcDayBounds(params.end).endUtc,
      },
      previous: {
        start: previousStart,
        end: previousEnd,
        ...getUtcDayBounds(previousStart),
        endUtc: getUtcDayBounds(previousEnd).endUtc,
      },
    };
  }

  const windowParam = params.window ?? '7d';
  const days = windowParam === '90d' ? 90 : windowParam === '30d' ? 30 : 7;
  const todayChicago = format(toZonedTime(new Date(), CITY_TZ), 'yyyy-MM-dd');
  const startA = format(subDays(parseISO(todayChicago), days - 1), 'yyyy-MM-dd');
  const endA = todayChicago;
  const startB = format(subDays(parseISO(todayChicago), 2 * days - 1), 'yyyy-MM-dd');
  const endB = format(subDays(parseISO(todayChicago), days), 'yyyy-MM-dd');

  return {
    current: {
      start: startA,
      end: endA,
      ...getUtcDayBounds(startA),
      endUtc: getUtcDayBounds(endA).endUtc,
    },
    previous: {
      start: startB,
      end: endB,
      ...getUtcDayBounds(startB),
      endUtc: getUtcDayBounds(endB).endUtc,
    },
  };
}

/** Exclude mock data: prefer real city data from Open Data / Bright Data. */
const REAL_DATA_FILTER = " AND event_time_source != 'mock_generator'";

/**
 * GET /api/signals
 * Accepts start/end in YYYY-MM-DD (local dates).
 * Server converts to UTC range using America/Chicago boundaries.
 * Filters on event_at_utc.
 */
router.get('/signals', (req, res) => {
  const parsed = signalsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    return res.status(400).json({ error: msg });
  }
  const { start, end, category, neighborhood, active_only } = parsed.data;

  try {
    const startLocal = startOfDay(parseISO(start));
    const endLocal = endOfDay(parseISO(end));
    const startUtc = fromZonedTime(startLocal, CITY_TZ).toISOString();
    const endUtc = fromZonedTime(endLocal, CITY_TZ).toISOString();

    let query = `
      SELECT * FROM signals
      WHERE event_at_utc >= ? AND event_at_utc <= ? ${REAL_DATA_FILTER}
    `;
    const params: (string | number)[] = [startUtc, endUtc];

    if (category && typeof category === 'string') {
      query += ` AND category = ?`;
      params.push(category);
    }

    if (neighborhood && typeof neighborhood === 'string') {
      query += ` AND neighborhood = ?`;
      params.push(neighborhood);
    }

    query += ` ORDER BY event_at_utc DESC`;

    let signals = db.prepare(query).all(...params) as Array<{
      category: string | null;
      neighborhood: string | null;
      lat: number | null;
      lng: number | null;
      raw_json: string | null;
      event_at_utc: string | null;
      ingested_at_utc: string | null;
      created_at_utc: string | null;
    }>;
    if (active_only === '1' || active_only === 'true') {
      signals = signals.filter((s) => isSignalActive(s));
    }
    res.json(hydrateSignals(signals));
  } catch (error) {
    console.error('Error fetching signals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/trends?window=7d
 * Window A: now-7d to now
 * Window B: now-14d to now-7d
 * Uses event_at_utc for both windows.
 * Returns overall counts, by category, by neighborhood, movers, optional confidence breakdown.
 */
router.get('/trends', (req, res) => {
  const parsed = trendsQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    return res.status(400).json({ error: msg });
  }
  const { window: windowParam, start, end } = parsed.data;

  if (start && end && parseISO(start) > parseISO(end)) {
    return res.status(400).json({ error: 'start must be before or equal to end' });
  }

  try {
    const windows = buildTrendWindows({ window: windowParam, start, end });
    const startA = windows.current.startUtc;
    const endA = windows.current.endUtc;
    const startB = windows.previous.startUtc;
    const endB = windows.previous.endUtc;

    const getStats = (startUtc: string, endUtc: string) => {
      const baseFilter = `event_at_utc >= ? AND event_at_utc <= ? ${REAL_DATA_FILTER}`;
      const total = db.prepare(
        `SELECT COUNT(*) as count FROM signals WHERE ${baseFilter}`
      ).get(startUtc, endUtc) as { count: number };

      const byCategory = db.prepare(`
        SELECT category, COUNT(*) as count FROM signals
        WHERE ${baseFilter}
        GROUP BY category
        ORDER BY count DESC
      `).all(startUtc, endUtc) as { category: string; count: number }[];

      const byNeighborhood = db.prepare(`
        SELECT neighborhood, COUNT(*) as count FROM signals
        WHERE ${baseFilter}
        GROUP BY neighborhood
        ORDER BY count DESC
      `).all(startUtc, endUtc) as { neighborhood: string; count: number }[];

      const byConfidence = db.prepare(`
        SELECT event_time_confidence as confidence, COUNT(*) as count FROM signals
        WHERE ${baseFilter}
        GROUP BY event_time_confidence
      `).all(startUtc, endUtc) as { confidence: string; count: number }[];

      return {
        total: total.count,
        byCategory,
        byNeighborhood,
        byConfidence,
      };
    };

    const statsA = getStats(startA, endA);
    const statsB = getStats(startB, endB);

    /** When previous=0 and current>0, percent is undefined (show "new activity" instead of +100%). */
    const safePercentChange = (current: number, previous: number): number | null =>
      previous === 0 ? (current > 0 ? null : 0) : ((current - previous) / previous) * 100;

    const categoryMovers = statsA.byCategory.map((a) => {
      const b = statsB.byCategory.find((x) => x.category === a.category);
      const bCount = b ? b.count : 0;
      const change = a.count - bCount;
      return {
        category: a.category,
        current: a.count,
        previous: bCount,
        change,
        percentChange: safePercentChange(a.count, bCount),
      };
    }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    const neighborhoodMovers = statsA.byNeighborhood.map((a) => {
      const b = statsB.byNeighborhood.find((x) => x.neighborhood === a.neighborhood);
      const bCount = b ? b.count : 0;
      const change = a.count - bCount;
      return {
        neighborhood: a.neighborhood,
        current: a.count,
        previous: bCount,
        change,
        percentChange: safePercentChange(a.count, bCount),
      };
    }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    const signalsPer10k = (statsA.total / MONTGOMERY_POPULATION) * 10000;
    const signalsPer10kPrev = (statsB.total / MONTGOMERY_POPULATION) * 10000;
    const signalsPer10kPercentChange = signalsPer10kPrev === 0
      ? null
      : ((signalsPer10k - signalsPer10kPrev) / signalsPer10kPrev) * 100;

    res.json({
      windowA: { start: startA, end: endA, stats: statsA },
      windowB: { start: startB, end: endB, stats: statsB },
      categoryMovers,
      neighborhoodMovers,
      overallChange: statsA.total - statsB.total,
      overallPercentChange:
        statsB.total === 0 ? null : ((statsA.total - statsB.total) / statsB.total) * 100,
      signalsPer10k: Math.round(signalsPer10k * 10) / 10,
      signalsPer10kChange: signalsPer10kPercentChange != null ? Math.round(signalsPer10kPercentChange * 10) / 10 : null,
      confidenceBreakdown: {
        windowA: statsA.byConfidence,
        windowB: statsB.byConfidence,
      },
    });
  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/digest?date=YYYY-MM-DD
 * Looks up by date_key. Returns digest with items, sources, metadata (event_at, confidence, source).
 */
router.get('/digest', (req, res) => {
  const parsed = digestQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    const msg = parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    return res.status(400).json({ error: msg });
  }
  const date = parsed.data.date ?? new Date().toISOString().split('T')[0];
  const category = parsed.data.category?.trim();

  try {
    const items = getDigestItemsByCategory(date, category);
    const digest = db.prepare(`SELECT * FROM digests WHERE date_key = ?`).get(date) as {
      id: string;
      date_key: string;
      event_at_utc: string;
      ingested_at_utc: string;
      event_time_confidence: string;
      event_time_source: string;
      items_json: string;
      sources_json: string;
      created_at_utc: string;
    } | undefined;

    if (!digest && items.length === 0) {
      return res.status(404).json({ error: 'Digest not found for this date' });
    }

    const sources = digest ? (() => {
      try {
        return JSON.parse(digest.sources_json);
      } catch {
        return [];
      }
    })() : [];
    const safeSources = Array.isArray(sources)
      ? sources
        .map((s: { label?: string; url?: string } | string) => {
          const url = typeof s === 'string' ? s : (s as { url?: string }).url;
          const label = typeof s === 'string' ? undefined : (s as { label?: string }).label;
          return { label, url };
        })
        .filter((s) => s.url && ensureExternalGovUrl(s.url))
        .map((s) => (s.label ? { label: s.label, url: ensureExternalGovUrl(s.url)! } : ensureExternalGovUrl(s.url)!))
      : [];

    res.json({
      items,
      sources: safeSources,
      metadata: digest ? {
        event_at: digest.event_at_utc,
        ingested_at: digest.ingested_at_utc,
        confidence: digest.event_time_confidence,
        source: digest.event_time_source,
      } : { event_at: new Date().toISOString(), ingested_at: new Date().toISOString(), confidence: 'LOW', source: 'digest_items' },
    });
  } catch (error) {
    console.error('Error fetching digest:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
