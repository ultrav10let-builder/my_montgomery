import express from 'express';
import { refreshSignals } from '../services/ingestService';

const router = express.Router();
let lastRefresh = 0;
const REFRESH_COOLDOWN = 60000; // 1 minute

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

export default router;
