import express from 'express';
import Database from 'better-sqlite3';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { subDays, startOfDay, endOfDay, formatISO, parseISO } from 'date-fns';

const router = express.Router();
const dbPath = process.env.SQLITE_PATH || './data/cache.sqlite';
const db = new Database(dbPath);

const CITY_TZ = 'America/Chicago';

/**
 * GET /api/signals
 * Query signals by date range, category, and neighborhood.
 */
router.get('/signals', (req, res) => {
  const { start, end, category, neighborhood } = req.query;

  if (!start || !end) {
    return res.status(400).json({ error: 'Start and end dates are required (YYYY-MM-DD)' });
  }

  try {
    // Convert local YYYY-MM-DD to UTC range
    const startUtc = fromZonedTime(startOfDay(parseISO(start as string)), CITY_TZ).toISOString();
    const endUtc = fromZonedTime(endOfDay(parseISO(end as string)), CITY_TZ).toISOString();

    let query = `
      SELECT * FROM signals 
      WHERE event_at_utc >= ? AND event_at_utc <= ?
    `;
    const params: any[] = [startUtc, endUtc];

    if (category) {
      query += ` AND category = ?`;
      params.push(category);
    }

    if (neighborhood) {
      query += ` AND neighborhood = ?`;
      params.push(neighborhood);
    }

    query += ` ORDER BY event_at_utc DESC`;

    const signals = db.prepare(query).all(...params);
    res.json(signals);
  } catch (error) {
    console.error('Error fetching signals:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/trends
 * Compare last N days vs prior N days.
 */
router.get('/trends', (req, res) => {
  const windowParam = (req.query.window as string) || '7d';
  const days = parseInt(windowParam.replace('d', '')) || 7;

  try {
    const now = new Date();
    const windowA_End = now;
    const windowA_Start = subDays(now, days);
    const windowB_End = windowA_Start;
    const windowB_Start = subDays(windowA_Start, days);

    const getStats = (start: Date, end: Date) => {
      const startUtc = start.toISOString();
      const endUtc = end.toISOString();

      const total = db.prepare(`
        SELECT COUNT(*) as count FROM signals 
        WHERE event_at_utc >= ? AND event_at_utc <= ?
      `).get(startUtc, endUtc) as { count: number };

      const byCategory = db.prepare(`
        SELECT category, COUNT(*) as count FROM signals 
        WHERE event_at_utc >= ? AND event_at_utc <= ?
        GROUP BY category
      `).all(startUtc, endUtc) as { category: string, count: number }[];

      const byNeighborhood = db.prepare(`
        SELECT neighborhood, COUNT(*) as count FROM signals 
        WHERE event_at_utc >= ? AND event_at_utc <= ?
        GROUP BY neighborhood
      `).all(startUtc, endUtc) as { neighborhood: string, count: number }[];

      return { total: total.count, byCategory, byNeighborhood };
    };

    const statsA = getStats(windowA_Start, windowA_End);
    const statsB = getStats(windowB_Start, windowB_End);

    // Calculate movers
    const categoryMovers = statsA.byCategory.map(a => {
      const b = statsB.byCategory.find(x => x.category === a.category);
      const bCount = b ? b.count : 0;
      const change = a.count - bCount;
      const percentChange = bCount === 0 ? 100 : (change / bCount) * 100;
      return { category: a.category, current: a.count, previous: bCount, change, percentChange };
    }).sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

    res.json({
      windowA: { start: windowA_Start, end: windowA_End, stats: statsA },
      windowB: { start: windowB_Start, end: windowB_End, stats: statsB },
      categoryMovers,
      overallChange: statsA.total - statsB.total,
      overallPercentChange: statsB.total === 0 ? 100 : ((statsA.total - statsB.total) / statsB.total) * 100
    });
  } catch (error) {
    console.error('Error fetching trends:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /api/digest
 * Load digest for a specific date.
 */
router.get('/digest', (req, res) => {
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'Date is required (YYYY-MM-DD)' });
  }

  try {
    const digest = db.prepare(`
      SELECT * FROM digests WHERE date_key = ?
    `).get(date);

    if (!digest) {
      return res.status(404).json({ error: 'Digest not found for this date' });
    }

    res.json(digest);
  } catch (error) {
    console.error('Error fetching digest:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
