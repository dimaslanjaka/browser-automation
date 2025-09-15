'use strict';

var minimist = require('minimist');
var sbgUtility = require('sbg-utility');
var utilsBrowser_js = require('../utils-browser.js');
var sehatindonesiakuData_js = require('./sehatindonesiaku-data.js');
var fs = require('fs-extra');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var minimist__default = /*#__PURE__*/_interopDefault(minimist);
var fs__default = /*#__PURE__*/_interopDefault(fs);

const args = minimist__default.default(process.argv.slice(2), { alias: { h: "help" } });
async function main(db) {
  let allData = await sehatindonesiakuData_js.getExcelData();
  if (args.nik) {
    allData = allData.filter((item) => item.nik === args.nik);
  }
  for (const item of allData) {
    console.log(`${item.nik} - Removing existing log`);
    await db.removeLog(item.nik);
    await utilsBrowser_js.sleep(100);
  }
  if (db.sqliteDbPath && fs__default.default.existsSync(db.sqliteDbPath)) {
    await db.close();
    console.log(`Deleting sqlite database path: ${db.sqliteDbPath}`);
    await fs__default.default.remove(db.sqliteDbPath).catch((error) => {
      console.error("Error deleting database file:", error.message);
    });
  }
}
function showHelp() {
  const [node, script] = process.argv;
  console.log(`Usage: ${sbgUtility.normalizePathUnix(node)} ${sbgUtility.normalizePathUnix(script)} [options]`);
  console.log("");
  console.log("Description:");
  console.log("  Remove/clean log entries from the kemkes database.");
  console.log("");
  console.log("Options:");
  console.log("  -h, --help         Show this help message");
  console.log("  --nik <NIK>        Only remove log for the specified NIK");
  console.log("");
  console.log("Examples:");
  console.log("  sehatindonesiaku-cleanDB");
  console.log("  sehatindonesiaku-cleanDB --nik 1234567890123456");
}
if (process.argv.some((arg) => /sehatindonesiaku-cleanDB\.(js|ts|cjs|mjs)$/.test(arg))) {
  (async () => {
    let db;
    try {
      if (args.help || args.h) {
        showHelp();
        return;
      }
      db = await sehatindonesiakuData_js.getSehatIndonesiaKuDb();
      await main(db);
    } finally {
      if (db) await db.close();
    }
  })();
}
//# sourceMappingURL=sehatindonesiaku-cleanDB.cjs.map
//# sourceMappingURL=sehatindonesiaku-cleanDB.cjs.map