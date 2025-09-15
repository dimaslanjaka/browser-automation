'use strict';

require('../chunk-4IBVXDKH.cjs');
var express = require('express');
var nikParser = require('nik-parser-jurusid');
var index_js = require('../../data/index.js');
var utilsBrowser_js = require('../utils-browser.js');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var express__default = /*#__PURE__*/_interopDefault(express);
var nikParser__default = /*#__PURE__*/_interopDefault(nikParser);

const router = express__default.default.Router();
router.get("/", async (req, res) => {
  const nik = utilsBrowser_js.getNumbersOnly(req.query.nik || req.query.NIK);
  if (!nik) {
    return res.status(400).json({ error: "Missing NIK parameter" });
  }
  let parsed = nikParser__default.default(nik);
  const dataKunto = await index_js.loadCsvData();
  parsed.current = dataKunto.find((item) => utilsBrowser_js.getNumbersOnly(item.nik) === nik);
  parsed = Object.fromEntries(Object.entries(parsed).sort(([a], [b]) => a.localeCompare(b)));
  res.json(parsed);
});
var nik_parser_default = router;

module.exports = nik_parser_default;
//# sourceMappingURL=nik-parser.cjs.map
//# sourceMappingURL=nik-parser.cjs.map