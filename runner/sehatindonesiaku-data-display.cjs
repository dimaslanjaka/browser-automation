'use strict';

require('../chunk-4IBVXDKH.cjs');
var path = require('path');
var sbgUtility = require('sbg-utility');
var sehatindonesiakuData_js = require('./sehatindonesiaku-data.js');
var jsonCrypto_js = require('../utils/json-crypto.js');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var path__default = /*#__PURE__*/_interopDefault(path);

async function getData() {
  const db = await sehatindonesiakuData_js.getSehatIndonesiaKuDb();
  const excelData = await sehatindonesiakuData_js.getExcelData();
  let logIndex = 0;
  for (let i = 0; i < excelData.length; i++) {
    const data = excelData[i];
    if (!data.nik) {
      process.stdout.write(`
[${logIndex}] dropping data for empty NIK
`);
      excelData.splice(i, 1);
      i--;
      logIndex++;
      continue;
    }
    const dataDb = await db.getLogById(data.nik);
    if (dataDb && dataDb.id) {
      process.stdout.write(`\r[${logIndex}] modifying data for NIK : ${data.nik}`);
      excelData[i] = { ...data, ...dataDb.data, messages: (dataDb.message || "").split(",").map((s) => s.trim()) };
    } else {
      process.stdout.write(`\r[${logIndex}] dropping data for NIK  : ${data.nik}`);
      excelData.splice(i, 1);
      i--;
    }
    logIndex++;
  }
  await db.close();
  return excelData;
}
async function generateDataDisplay() {
  const data = await getData();
  const outputPath = path__default.default.join(process.cwd(), "public/assets/data/sehatindonesiaku-data.json");
  sbgUtility.writefile(outputPath, jsonCrypto_js.encryptJson(data, process.env.VITE_JSON_SECRET));
  console.log(`Output written to: ${outputPath}`);
}
if (process.argv.some((arg) => arg.includes("sehatindonesiaku-data-display"))) {
  generateDataDisplay();
}

exports.generateDataDisplay = generateDataDisplay;
//# sourceMappingURL=sehatindonesiaku-data-display.cjs.map
//# sourceMappingURL=sehatindonesiaku-data-display.cjs.map