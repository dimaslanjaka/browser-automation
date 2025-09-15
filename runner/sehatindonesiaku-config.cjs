'use strict';

require('../chunk-4IBVXDKH.cjs');
var minimist = require('minimist');
var moment = require('moment');
var sbgUtility = require('sbg-utility');
var sehatindonesiakuData_js = require('./sehatindonesiaku-data.js');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var minimist__default = /*#__PURE__*/_interopDefault(minimist);
var moment__default = /*#__PURE__*/_interopDefault(moment);

const args = minimist__default.default(process.argv.slice(2), {
  alias: { h: "help" }
});
function showHelp() {
  const [node, script] = process.argv;
  console.log(`Usage: ${sbgUtility.normalizePathUnix(node)} ${sbgUtility.normalizePathUnix(script)} [options]`);
  console.log("");
  console.log("Options:");
  console.log("  -h, --help                Show this help message");
  console.log("  --tanggal_pemeriksaan      Set the tanggal_pemeriksaan (DD/MM/YYYY)");
  console.log("  --provinsi                 Set the provinsi");
  console.log("  --kabupaten                Set the kabupaten");
  console.log("  --kecamatan                Set the kecamatan");
  console.log("  --kelurahan                Set the kelurahan");
}
if (args.help) {
  showHelp();
  process.exit(0);
}
function isEmpty(str) {
  return !str || str.trim().length === 0;
}
function exitWithError(message) {
  console.error(message);
  process.exit(1);
}
const validators = {
  tanggal_pemeriksaan: (val) => {
    const parsed = moment__default.default(val, "DD/MM/YYYY", true);
    if (!parsed.isValid()) exitWithError("Invalid tanggal_pemeriksaan format, expected DD/MM/YYYY");
    sehatindonesiakuData_js.sehatindonesiakuPref.putString("tanggal_pemeriksaan", val);
  },
  provinsi: (val) => {
    if (isEmpty(val)) exitWithError("Invalid provinsi, cannot be empty");
    sehatindonesiakuData_js.sehatindonesiakuPref.putString("provinsi", val);
  },
  kabupaten: (val) => {
    if (isEmpty(val)) exitWithError("Invalid kabupaten, cannot be empty");
    sehatindonesiakuData_js.sehatindonesiakuPref.putString("kabupaten", val);
  },
  kecamatan: (val) => {
    if (isEmpty(val)) exitWithError("Invalid kecamatan, cannot be empty");
    sehatindonesiakuData_js.sehatindonesiakuPref.putString("kecamatan", val);
  },
  kelurahan: (val) => {
    if (isEmpty(val)) exitWithError("Invalid kelurahan, cannot be empty");
    sehatindonesiakuData_js.sehatindonesiakuPref.putString("kelurahan", val);
  }
};
let noMatch = true;
for (const [key, validate] of Object.entries(validators)) {
  const val = args[key];
  if (val !== void 0) {
    validate(val);
    noMatch = false;
  }
}
if (process.argv.some((arg) => arg.includes("sehatindonesiaku-config"))) {
  if (noMatch) {
    showHelp();
  } else {
    console.log("Configuration updated successfully.");
  }
  process.exit(0);
}

exports.showHelp = showHelp;
//# sourceMappingURL=sehatindonesiaku-config.cjs.map
//# sourceMappingURL=sehatindonesiaku-config.cjs.map