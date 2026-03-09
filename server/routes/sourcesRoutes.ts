import express from 'express';
import db from '../storage/db';
import { BRIGHTDATA_SOURCE_COVERAGE } from '../services/digestService';
import { HIGH_VALUE_HISTORICAL_DATASETS, OPEN_DATA_HUB_URLS } from '../services/ingestService';

const router = express.Router();

router.get('/sources/coverage', (_req, res) => {
  try {
    const trackedSources = db.prepare('SELECT * FROM sources ORDER BY label ASC').all();
    res.json({
      brightData: {
        configuredSources: BRIGHTDATA_SOURCE_COVERAGE,
        totalConfiguredSources: BRIGHTDATA_SOURCE_COVERAGE.length,
      },
      openData: {
        configuredHubUrls: OPEN_DATA_HUB_URLS,
        totalConfiguredHubUrls: OPEN_DATA_HUB_URLS.length,
        auditedHighValueDatasets: HIGH_VALUE_HISTORICAL_DATASETS,
      },
      trackedSources,
    });
  } catch (error) {
    console.error('Failed to fetch source coverage:', error);
    res.status(500).json({ error: 'Failed to fetch source coverage' });
  }
});

router.get('/sources', (req, res) => {
  try {
    const sources = db.prepare('SELECT * FROM sources').all();
    res.json(sources);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sources' });
  }
});

export default router;
