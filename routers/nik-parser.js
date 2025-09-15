import '../chunk-BUSYA2B4.js';
import express from 'express';
import nikParser from 'nik-parser-jurusid';
import { loadCsvData } from '../../data/index.js';
import { getNumbersOnly } from '../utils-browser.js';

const router = express.Router();
router.get("/", async (req, res) => {
  const nik = getNumbersOnly(req.query.nik || req.query.NIK);
  if (!nik) {
    return res.status(400).json({ error: "Missing NIK parameter" });
  }
  let parsed = nikParser(nik);
  const dataKunto = await loadCsvData();
  parsed.current = dataKunto.find((item) => getNumbersOnly(item.nik) === nik);
  parsed = Object.fromEntries(Object.entries(parsed).sort(([a], [b]) => a.localeCompare(b)));
  res.json(parsed);
});
var nik_parser_default = router;

export { nik_parser_default as default };
//# sourceMappingURL=nik-parser.js.map
//# sourceMappingURL=nik-parser.js.map