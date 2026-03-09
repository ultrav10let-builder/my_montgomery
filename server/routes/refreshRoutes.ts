import express from 'express';
import { refreshSignals } from '../services/ingestService';
import { generateDailyDigest } from '../services/digestService';
import { refreshTrafficFeeds } from '../services/trafficFeedService';
import { scrapeUrl } from '../brightdata/browserScraper';
import { getBrightDataScheduleStatus } from '../brightdata/scheduleStatus';
import { hasValidAdminToken, parseBrightDataHealthQuery } from '../utils/requestValidation';

const router = express.Router();

/** GET /api/brightdata/status - Schedule status for verification (no auth) */
router.get('/brightdata/status', (_req, res) => {
  res.json(getBrightDataScheduleStatus());
});

/** GET /api/health/brightdata - Test Bright Data connection
 *  Default: geo.brdtest.com (Bright Data's allowed test URL) - verifies credentials
 *  ?target=city - Use montgomeryal.gov (may be blocked for Government classification)
 */
router.get('/health/brightdata', async (req, res) => {
  if (!process.env.BRIGHTDATA_BROWSER_WSS) {
    return res.json({ ok: false, error: 'BRIGHTDATA_BROWSER_WSS not configured' });
  }
  const parsed = parseBrightDataHealthQuery(req.query);
  if (parsed.success === false) {
    return res.status(400).json({ error: parsed.error });
  }
  const { useCity } = parsed;
  const target = useCity ? 'https://www.montgomeryal.gov/' : 'https://geo.brdtest.com/welcome.txt';
  console.log('[Bright Data health] target=', useCity ? 'city' : 'connect', target);
  try {
    const result = await scrapeUrl(target);
    res.json({
      ok: true,
      title: result.title,
      textLength: result.text.length,
      scrapedAt: result.extractedAt,
      target: useCity ? 'city' : 'connect',
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Bright Data health check]', msg);
    res.status(502).json({ ok: false, error: msg, target: useCity ? 'city' : 'connect' });
  }
});
let lastRefresh = 0;
const REFRESH_COOLDOWN = 60000; // 1 minute
let lastDigestRefresh = 0;
const DIGEST_REFRESH_COOLDOWN = 60000 * 5; // 5 minutes
let lastTrafficRefresh = 0;
const TRAFFIC_REFRESH_COOLDOWN = 60000 * 2; // 2 minutes

router.post('/refresh/signals', async (req, res) => {
  const now = Date.now();
  if (now - lastRefresh < REFRESH_COOLDOWN) {
    return res.status(429).json({ error: 'Refresh already in progress or too frequent' });
  }

  lastRefresh = now;
  try {
    // Run in background
    refreshSignals().catch(err => console.error('Background refresh failed:', err));
    res.json({ message: 'Refresh started' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start refresh' });
  }
});

router.post('/refresh/traffic', async (req, res) => {
  const expectedToken = process.env.ADMIN_TOKEN;
  if (!hasValidAdminToken(req.headers, expectedToken)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid admin token' });
  }
  const now = Date.now();
  if (now - lastTrafficRefresh < TRAFFIC_REFRESH_COOLDOWN) {
    return res.status(429).json({ error: 'Traffic refresh too frequent. Wait 2 minutes.' });
  }
  lastTrafficRefresh = now;
  try {
    refreshTrafficFeeds().catch((err) => console.error('Background traffic refresh failed:', err));
    res.json({ message: 'Traffic feed refresh started' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start traffic refresh' });
  }
});

router.post('/refresh/digest', async (req, res) => {
  const expectedToken = process.env.ADMIN_TOKEN;
  if (!hasValidAdminToken(req.headers, expectedToken)) {
    return res.status(401).json({ error: 'Unauthorized: Invalid admin token' });
  }
  const now = Date.now();
  if (now - lastDigestRefresh < DIGEST_REFRESH_COOLDOWN) {
    return res.status(429).json({ error: 'Digest refresh too frequent. Wait 5 minutes.' });
  }
  lastDigestRefresh = now;
  try {
    generateDailyDigest().catch((err) => console.error('Background digest refresh failed:', err));
    res.json({ message: 'Digest refresh started' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start digest refresh' });
  }
});

export default router;
