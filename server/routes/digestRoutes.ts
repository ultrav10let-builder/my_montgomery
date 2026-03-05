import express from 'express';
import { generateDailyDigest, getLatestDigest } from '../services/digestService';

const router = express.Router();
let lastRefresh = 0;
const REFRESH_COOLDOWN = 60000 * 5; // 5 minutes

// POST /api/refresh/digest (admin protected + rate-limited)
router.post('/refresh/digest', async (req, res) => {
  const adminToken = req.headers['x-admin-token'];
  const expectedToken = process.env.ADMIN_TOKEN;

  if (!expectedToken || adminToken !== expectedToken) {
    return res.status(401).json({ error: 'Unauthorized: Invalid admin token' });
  }

  const now = Date.now();
  if (now - lastRefresh < REFRESH_COOLDOWN) {
    return res.status(429).json({ error: 'Refresh already in progress or too frequent' });
  }

  lastRefresh = now;
  try {
    // Run in background
    generateDailyDigest().catch(err => console.error('Background digest refresh failed:', err));
    res.json({ message: 'Digest refresh started' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start digest refresh' });
  }
});

// GET /api/digest/today
router.get('/digest/today', (req, res) => {
  const digest = getLatestDigest();
  if (digest) {
    res.json(digest);
  } else {
    res.status(404).json({ error: 'No digest found for today' });
  }
});

export default router;
