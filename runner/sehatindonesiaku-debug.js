import fs from 'fs-extra';
import path from 'path';
import './sehatindonesiaku-kehadiran.js';
import './sehatindonesiaku-registrasi.js';
import { getSehatIndonesiaKuDb } from './sehatindonesiaku-data.js';

const logFile = path.join(process.cwd(), "tmp/logs/debug.log");
fs.ensureDirSync(path.dirname(logFile));
fs.writeFileSync(logFile, "");
const _log = console.log;
const _error = console.error;
console.log = (...args) => {
  _log(...args);
  const map = args.map((arg) => {
    if (typeof arg === "object") {
      return JSON.stringify(arg);
    } else if (typeof arg === "boolean") {
      return arg ? "true" : "false";
    }
    return arg;
  });
  fs.appendFileSync(logFile, `${map.join(" ")}
`);
};
console.error = (...args) => {
  _error(...args);
  const map = args.map((arg) => {
    if (typeof arg === "object") {
      return JSON.stringify(arg);
    } else if (typeof arg === "boolean") {
      return arg ? "true" : "false";
    }
    return arg;
  });
  fs.appendFileSync(logFile, `[ERROR] ${map.join(" ")}
`);
};
async function _main(callback) {
  const db = await getSehatIndonesiaKuDb();
  await callback(db);
  await db.close();
}
async function _debugData(db, options) {
  const { getExcelData } = await import('./sehatindonesiaku-data.js');
  const allExcelData = await getExcelData();
  const allDbData = await db.getLogs();
  console.log(`Total records from Excel: ${allExcelData.length}`);
  console.log(`Total records from Database: ${allDbData.length}`);
  let allData = [
    ...allExcelData.map((item) => ({ ...item, type: "excel" })),
    ...allDbData.map((log) => ({ ...log.data, type: "db" }))
  ].filter((item) => {
    return item && Object.keys(item).length > 0;
  });
  if (options == null ? void 0 : options.nik) {
    allData = allData.filter((item) => item.nik === options.nik);
    if (allData.length === 0) {
      console.log(`No data found for NIK ${options.nik}`);
      return;
    }
    console.log(`Filtered results for NIK ${options.nik}:`, allData);
  }
  allData.forEach((item, index) => {
    const foundInExcel = allExcelData.some((d) => d.nik === item.nik);
    if (!foundInExcel) return;
    console.log(`[${index + 1}/${allData.length}] NIK: ${item.nik} - ${item.nama}`);
    console.log(`	-> from: ${item.type}`);
    console.log(`	-> registered: ${item.registered}`);
    console.log(`	-> hadir: ${item.hadir}
`);
  });
}
async function _testRegistrasiFilter(db) {
  const nik = `3173055605081003`;
  process.argv.push(`--nik=${nik.trim()}`);
  await _debugData(db, { nik });
}
_main(async function(db) {
  await _testRegistrasiFilter(db);
}).catch(console.error).finally(() => {
  _log(`Log saved ${logFile}`);
});
//# sourceMappingURL=sehatindonesiaku-debug.js.map
//# sourceMappingURL=sehatindonesiaku-debug.js.map