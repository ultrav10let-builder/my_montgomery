/**
 * AI Insights API
 *
 * GET /api/insights?window=7d
 * GET /api/insights?window=7d&district=3
 * GET /api/insights?start=2025-02-01&end=2025-02-15
 * window: live|7d|30d|90d (live maps to 7d)
 * Custom range: start and end in YYYY-MM-DD.
 * Flow: cache check → trend engine → AI generator → cache store → response
 */

import express from 'express';
import { generateInsight } from '../services/aiInsightGenerator';
import { parseInsightsQuery } from '../utils/requestValidation';

const router = express.Router();

router.get('/insights', async (req, res) => {
  const parsed = parseInsightsQuery(req.query);
  if (parsed.success === false) {
    return res.status(400).json({ error: parsed.error });
  }

  const { spec, district } = parsed;

  try {
    const result = await generateInsight(spec, district);
    res.json({
      window: result.window,
      mode: result.mode,
      provider: result.provider,
      generatedAt: result.generatedAt,
      insight: result.insight,
    });
  } catch (err) {
    console.error('[Insights API]', err);
    res.status(500).json({
      error: 'Failed to generate insight',
      window: typeof spec === 'object' ? `custom:${spec.start}:${spec.end}` : spec,
      mode: 'fallback',
      provider: 'fallback',
      generatedAt: new Date().toISOString(),
      insight: '',
    });
  }
});

export default router;
