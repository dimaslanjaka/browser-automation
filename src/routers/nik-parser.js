import express from 'express';
import nikParser from 'nik-parser-jurusid';

const router = express.Router();

// Sample endpoint: GET /nik-parser?nik=1234567890123456
router.get('/', (req, res) => {
  const nik = req.query.nik;
  if (!nik) {
    return res.status(400).json({ error: 'Missing NIK parameter' });
  }
  // Dummy parse logic
  const parsed = nikParser(nik);
  res.json(parsed);
});

export default router;
