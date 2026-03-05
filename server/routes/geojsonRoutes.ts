import express from 'express';
import fs from 'fs';
import path from 'path';

const router = express.Router();
const geojsonDir = path.join(process.cwd(), 'data', 'geojson');

router.get('/geojson/:layer', (req, res) => {
  const layer = req.params.layer;
  const filePath = path.join(geojsonDir, `${layer}.geojson`);

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'Layer not found' });
  }
});

export default router;
