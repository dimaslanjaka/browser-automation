import express from 'express';
import nikParser from 'nik-parser-jurusid';
import { dataKunto } from '../../data/index.js';
import { getNumbersOnly } from '../utils.js';

const router = express.Router();

// Sample endpoint: GET /nik-parser?nik=1234567890123456
router.get('/', (req, res) => {
  const nik = getNumbersOnly(req.query.nik || req.query.NIK);
  if (!nik) {
    return res.status(400).json({ error: 'Missing NIK parameter' });
  }
  // Parse the NIK using nik-parser-jurusid
  let parsed = nikParser(nik);
  // Find the corresponding item in dataKunto
  parsed.current = dataKunto.find((item) => getNumbersOnly(item.nik) === nik);
  parsed = Object.fromEntries(Object.entries(parsed).sort(([a], [b]) => a.localeCompare(b)));
  res.json(parsed);
});

export default router;
