/**
 * Traffic Feeds API
 *
 * GET /api/traffic/feeds - Latest traffic incidents (last 12h default, 4h when live=true)
 * GET /api/traffic/feeds?live=true - Active incidents only (exclude expired, last 4h)
 */

import express from 'express';
import { getLatestTrafficFeeds } from '../services/trafficFeedService';
import { parseTrafficFeedsQuery } from '../utils/requestValidation';

const router = express.Router();

router.get('/traffic/feeds', (req, res) => {
  const parsed = parseTrafficFeedsQuery(req.query);
  if (parsed.success === false) {
    return res.status(400).json({ error: parsed.error });
  }

  try {
    const feeds = getLatestTrafficFeeds(parsed.live);
    res.json(feeds);
  } catch (err) {
    console.error('[Traffic API]', err);
    res.status(500).json({ error: 'Failed to fetch traffic feeds' });
  }
});

export default router;

