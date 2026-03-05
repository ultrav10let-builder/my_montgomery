import express from 'express';
import db from '../storage/db';

const router = express.Router();

router.get('/sources', (req, res) => {
  try {
    const sources = db.prepare('SELECT * FROM sources').all();
    res.json(sources);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sources' });
  }
});

export default router;
