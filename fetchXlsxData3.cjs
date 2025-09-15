'use strict';

require('./chunk-4IBVXDKH.cjs');
var glob = require('glob');
var moment = require('moment-timezone');
var nikParse = require('nik-parser-jurusid');
var fs = require('node:fs');
var path = require('node:path');
var sbgUtility = require('sbg-utility');
var url = require('url');
var XLSX = require('xlsx');
var SharedPrefs_js = require('./SharedPrefs.js');
var date_js = require('./date.js');
var xlsxHelper_js = require('./xlsx-helper.js');

var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var glob__namespace = /*#__PURE__*/_interopNamespace(glob);
var moment__default = /*#__PURE__*/_interopDefault(moment);
var nikParse__default = /*#__PURE__*/_interopDefault(nikParse);
var fs__default = /*#__PURE__*/_interopDefault(fs);
var path__default = /*#__PURE__*/_interopDefault(path);
var XLSX__namespace = /*#__PURE__*/_interopNamespace(XLSX);

const __filename$1 = url.fileURLToPath((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('fetchXlsxData3.cjs', document.baseURI).href)));
path__default.default.dirname(__filename$1);
const shared_prefs = new SharedPrefs_js.SharedPrefs("sheets", ".cache/shared_prefs");
const outputSheetJsonFile = path__default.default.join(process.cwd(), ".cache/sheets/debug_output.json");
async function fetchXlsxData3(startIndex = 0, lastIndex = Number.MAX_SAFE_INTEGER, options = {}) {
  const parsedStartIndex = startIndex === null || startIndex === void 0 ? 0 : typeof startIndex === "string" ? parseInt(startIndex, 10) : startIndex;
  const parsedLastIndex = lastIndex === null || lastIndex === void 0 ? Number.MAX_SAFE_INTEGER : typeof lastIndex === "string" ? parseInt(lastIndex, 10) : lastIndex;
  const finalStartIndex = isNaN(parsedStartIndex) ? 0 : parsedStartIndex;
  const finalLastIndex = isNaN(parsedLastIndex) ? Number.MAX_SAFE_INTEGER : parsedLastIndex;
  const files = await glob__namespace.glob(".cache/sheets/*.xlsx", {
    cwd: process.cwd(),
    absolute: true
  });
  if (files.length === 0) {
    throw new Error("No Excel files found.");
  }
  const fileHash = xlsxHelper_js.getFileHash(files[0]);
  const cacheKey = xlsxHelper_js.getCacheKey("fetchXlsxData3", fileHash, finalStartIndex, finalLastIndex);
  if (!options.noCache) {
    const cachedData = xlsxHelper_js.getCachedData(cacheKey);
    if (cachedData) {
      return cachedData;
    }
  }
  if (!options.noCache) console.log(`Cache miss: ${cacheKey} - Processing Excel file...`);
  const workbook = XLSX__namespace.read(fs__default.default.readFileSync(files[0]), { cellDates: true });
  const allSheetsData = {};
  let customRangeData = {};
  const keyMap = {
    TANGGAL: "tanggal",
    "TANGGAL ENTRY": "tanggal",
    NAMA: "nama",
    "NAMA PASIEN": "nama",
    NIK: "nik",
    "NIK PASIEN": "nik",
    PEKERJAAN: "pekerjaan",
    "BERAT BADAN": "bb",
    BB: "bb",
    "TINGGI BADAN": "tb",
    TB: "tb",
    BATUK: "batuk",
    DM: "diabetes",
    "TGL LAHIR": "tgl_lahir",
    "TANGGAL LAHIR": "tgl_lahir",
    "TANGGAL LAHIR PASIEN": "tgl_lahir",
    ALAMAT: "alamat",
    "ALAMAT PASIEN": "alamat",
    "JENIS KELAMIN": "jenis_kelamin",
    "PETUGAS YG MENG ENTRY": "petugas",
    "PETUGAS ENTRY": "petugas"
  };
  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const raw = XLSX__namespace.utils.sheet_to_json(sheet, { header: 1 });
    const headerRowIndex = 7487;
    const dataStartIndex = headerRowIndex + 1;
    const headers = raw[headerRowIndex];
    const jsonData = XLSX__namespace.utils.sheet_to_json(sheet, {
      raw: false,
      cellDates: true,
      dateNF: "DD/MM/YYYY",
      range: dataStartIndex,
      header: headers
    });
    const rawJsonData = XLSX__namespace.utils.sheet_to_json(sheet, {
      raw: true,
      cellDates: true,
      dateNF: "DD/MM/YYYY",
      range: dataStartIndex,
      header: headers
    });
    allSheetsData[sheetName] = jsonData.map((row, index) => {
      const rawRow = rawJsonData[index];
      let transformedRow = { rowIndex: dataStartIndex + index };
      Object.values(keyMap).forEach((mappedKey) => {
        transformedRow[mappedKey] = void 0;
      });
      let sharedPrefsKey = "";
      let shared_prefs_data = {};
      for (const key of Object.keys(row)) {
        const newKey = keyMap[key] || key;
        let value = row[key];
        if (newKey === "nik") {
          sharedPrefsKey = `nik_${value}`;
          shared_prefs_data = shared_prefs.get(sharedPrefsKey, {});
          const nik_parser_result = nikParse__default.default(value);
          transformedRow.parsed_nik = nik_parser_result.data || {};
        }
        if (newKey === "tanggal") {
          if (value instanceof Date) {
            value = value.toLocaleDateString("en-GB");
          } else if (typeof value === "string") {
            const matchHypens = value.match(/^\d{2}-\d{2}-\d{4}$/);
            if (matchHypens) value = value.replace(/-/g, "/");
          }
          if (date_js.containsMonth(value)) {
            if (moment__default.default(shared_prefs_data.saved_generated_date, "DD/MM/YYYY", true).isValid()) {
              value = shared_prefs_data.saved_generated_date;
            } else {
              const newValue = sbgUtility.array_random(
                date_js.getDatesWithoutSundays(date_js.extractMonthName(value), (/* @__PURE__ */ new Date()).getFullYear(), "DD/MM/YYYY", true)
              );
              if (moment__default.default(newValue, "DD/MM/YYYY", true).isValid()) {
                value = newValue;
                shared_prefs_data.saved_generated_date = newValue;
              }
            }
          }
          if (!["tanggal entry"].includes(value.trim().toLowerCase()) && !value.includes("/")) {
            throw new Error(`Invalid string date: ${value}`);
          }
        }
        if (newKey === "bb" || newKey === "tb") {
          value = parseFloat(`${value}`.replace(",", ".")) || null;
        }
        transformedRow[newKey] = value;
      }
      const rawNikKey = Object.keys(rawRow).find((k) => (keyMap[k] || k) === "nik");
      if (rawNikKey && rawRow[rawNikKey] !== void 0) {
        transformedRow.nik = String(rawRow[rawNikKey]).replace(/\.0+$/, "");
      }
      if (transformedRow.nik) {
        shared_prefs_data.nik = transformedRow.nik;
        shared_prefs.set(sharedPrefsKey, shared_prefs_data);
      }
      return transformedRow;
    });
    allSheetsData[sheetName] = allSheetsData[sheetName].map((row, _index) => {
      if (row.tgl_lahir && row.parsed_nik && row.parsed_nik.lahir) {
        row.parsed_nik.original_lahir = row.parsed_nik.lahir;
        row.parsed_nik.lahir = row.tgl_lahir;
      }
      if (!moment__default.default(row.tgl_lahir, "DD/MM/YYYY", true).isValid()) {
        if (row.tgl_lahir.includes("-")) {
          const transform = moment__default.default(row.tgl_lahir, "YYYY-MM-DD", true);
          if (transform.isValid()) {
            row.tgl_lahir = transform.format("DD/MM/YYYY");
          }
        } else {
          throw new Error(
            `Invalid tgl_lahir date format in row ${row.rowIndex} of sheet '${sheetName}': ${row.tgl_lahir}`
          );
        }
      }
      return row;
    });
    customRangeData = allSheetsData[sheetName].filter(
      (row) => row.rowIndex >= finalStartIndex && row.rowIndex <= finalLastIndex
    );
  });
  fs__default.default.writeFileSync(outputSheetJsonFile, JSON.stringify(allSheetsData, null, 2), "utf8");
  xlsxHelper_js.saveCachedData(cacheKey, customRangeData);
  return customRangeData;
}
if (process.argv[1] === __filename$1) {
  (async () => {
    console.log(
      `Fetching data from Excel files... (start index: ${process.env.index_start}, end index: ${process.env.index_end})`
    );
    const datas = await fetchXlsxData3(0, 9e4);
    for (const data of datas) {
      if (data.nik && !/^\d+$/.test(data.nik)) {
        throw new Error(`data.nik is not numeric at rowIndex ${data.rowIndex}: ${data.nik}`);
      }
      if (data.nik.trim() == "3578106311200003") {
        console.log("Found special NIK:", data.nik, "at rowIndex:", data.rowIndex);
        console.log("Data:", data);
      }
    }
  })();
}

exports.fetchXlsxData3 = fetchXlsxData3;
//# sourceMappingURL=fetchXlsxData3.cjs.map
//# sourceMappingURL=fetchXlsxData3.cjs.map