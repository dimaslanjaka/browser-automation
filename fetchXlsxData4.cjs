'use strict';

require('./chunk-4IBVXDKH.cjs');
var ExcelJS = require('exceljs');
var moment = require('moment');
var path = require('path');
var url = require('url');
var utils_js = require('./utils.js');
var utilsBrowser_js = require('./utils-browser.js');
var xlsxHelper_js = require('./xlsx-helper.js');

var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var ExcelJS__default = /*#__PURE__*/_interopDefault(ExcelJS);
var moment__default = /*#__PURE__*/_interopDefault(moment);
var path__default = /*#__PURE__*/_interopDefault(path);

const __filename$1 = url.fileURLToPath((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('fetchXlsxData4.cjs', document.baseURI).href)));
async function fetchXlsxData4(options = {}) {
  const { noCache = false } = options;
  const xlsxFile = path__default.default.join(process.cwd(), ".cache", "sheets", "spreadsheet-" + process.env.SPREADSHEET_ID + ".xlsx");
  if (!xlsxFile) {
    throw new Error("No Excel files found in .cache/sheets directory");
  }
  const fileHash = xlsxHelper_js.getFileHash(xlsxFile);
  const cacheKey = xlsxHelper_js.getCacheKey("fetchXlsxData4", fileHash);
  if (!noCache) {
    const cachedData = xlsxHelper_js.getCachedData(cacheKey);
    if (cachedData) {
      return cachedData;
    }
  }
  const workbookReader = new ExcelJS__default.default.stream.xlsx.WorkbookReader(xlsxFile);
  const jsonData = [];
  let before7488Headers = null;
  let after7488Headers = null;
  const nikMap = /* @__PURE__ */ new Map();
  for await (const worksheetReader of workbookReader) {
    let rowNumber = 0;
    for await (const row of worksheetReader) {
      rowNumber++;
      const allValues = row.values.slice(1);
      if (rowNumber === 1) {
        if (allValues.some((v) => v && v !== "")) {
          before7488Headers = allValues;
          continue;
        }
      }
      if (rowNumber === 7488) {
        after7488Headers = allValues.slice(9, 17);
        continue;
      }
      let values, usedHeaders, currentRegion;
      if (rowNumber < 7488) {
        usedHeaders = before7488Headers;
        values = allValues;
        currentRegion = 0;
      } else if (rowNumber > 7488) {
        usedHeaders = after7488Headers;
        values = allValues.slice(9, 17);
        currentRegion = 1;
      } else {
        continue;
      }
      if (!values || values.length === 0 || values.every((v) => v === void 0 || v === null || v === "")) {
        continue;
      }
      const rowData = {};
      values.forEach((value, index) => {
        const header = usedHeaders && usedHeaders[index];
        if (header && value !== void 0 && value !== null && value !== "") {
          if ((header === "TGL LAHIR" || header === "TANGGAL") && typeof value === "number") {
            const baseDate = moment__default.default("1900-01-01");
            const daysSinceBase = value - 1;
            const adjustedDays = daysSinceBase > 59 ? daysSinceBase - 1 : daysSinceBase;
            const resultDate = baseDate.clone().add(adjustedDays, "days");
            rowData[header] = resultDate.format("DD/MM/YYYY");
          } else {
            rowData[header] = value;
          }
        }
      });
      if (Object.keys(rowData).length > 0) {
        rowData.originalRowNumber = rowNumber;
        rowData.headerRegion = currentRegion;
        if (rowData.NIK) {
          const nikKey = utilsBrowser_js.getNumbersOnly(rowData.NIK);
          const existing = nikMap.get(nikKey);
          if (!existing || rowData.headerRegion === 1) {
            nikMap.set(nikKey, rowData);
          }
        } else {
          jsonData.push(rowData);
        }
      }
    }
    break;
  }
  const deduped = [...nikMap.values(), ...jsonData];
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
  const mapped = deduped.map((row) => {
    const newRow = {};
    for (const key in row) {
      const mappedKey = keyMap[key] || key;
      newRow[mappedKey] = row[key];
    }
    return newRow;
  });
  xlsxHelper_js.saveCachedData(cacheKey, mapped);
  return mapped;
}
if (process.argv[1] === __filename$1) {
  (async () => {
    try {
      const outputFile = path__default.default.join(process.cwd(), "tmp", "range-data-output.json");
      const rangeData = await xlsxHelper_js.getDataRange(await fetchXlsxData4(), {
        fromNik: "3578106311200003",
        fromNama: "NI NYOMAN ANINDYA MAHESWARI",
        toNik: "3578101502250001",
        toNama: "MUHAMMAD NATHAN ALFATIR",
        outputFile
      });
      utils_js.logLine(`
Successfully extracted ${rangeData.length} rows`);
      const actualDatas = [
        { index: 0, "TGL LAHIR": "23/11/2020", NAMA: "NI NYOMAN ANINDYA MAHESWARI", NIK: "3578106311200003" },
        {
          index: 10,
          "TGL LAHIR": moment__default.default("2022-05-10", "YYYY-MM-DD").format("DD/MM/YYYY"),
          NAMA: "SADDAM AQSABYAN",
          NIK: "3578101005220004"
        },
        {
          NIK: "3578100610230010",
          NAMA: "SEO EVELYN NABUD",
          "TGL LAHIR": moment__default.default("2023-10-06", "YYYY-MM-DD").format("DD/MM/YYYY")
        }
      ];
      const totalRows = rangeData.length;
      let currentRow = 0;
      while (rangeData.length > 0) {
        const data = rangeData.shift();
        if (!data) continue;
        utils_js.logInline(`Processing row ${currentRow} of ${totalRows}`);
        const actualData = actualDatas.find(
          (item) => item.index === currentRow || item.NAMA && data.NAMA && item.NAMA.trim().toLowerCase() === data.NAMA.trim().toLowerCase() || item.NIK && data.NIK && utilsBrowser_js.getNumbersOnly(item.NIK) === utilsBrowser_js.getNumbersOnly(data.NIK)
        );
        if (actualData) {
          const get = await xlsxHelper_js.fixData(data);
          utils_js.logLine(
            `
Row ${currentRow}:
	TGL LAHIR (fixed): ${get["TGL LAHIR"]} | Expected: ${actualData["TGL LAHIR"]} | Match: ${get["TGL LAHIR"] === actualData["TGL LAHIR"]}
	NAMA: ${get["NAMA"]} | Expected: ${actualData["NAMA"]} | Match: ${get["NAMA"] === actualData["NAMA"]}`
          );
        }
        currentRow++;
      }
      utils_js.logLine(`
Processing completed. Processed ${currentRow} rows total.`);
      process.exit(0);
    } catch (error) {
      utils_js.logLine(error);
    }
  })().catch(utils_js.logLine);
}

exports.fetchXlsxData4 = fetchXlsxData4;
//# sourceMappingURL=fetchXlsxData4.cjs.map
//# sourceMappingURL=fetchXlsxData4.cjs.map