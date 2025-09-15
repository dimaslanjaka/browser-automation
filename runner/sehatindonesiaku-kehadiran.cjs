'use strict';

require('../chunk-4IBVXDKH.cjs');
var fs = require('fs-extra');
var minimist = require('minimist');
var sbgUtility = require('sbg-utility');
var puppeteerErrors_cjs = require('../puppeteer-errors.cjs');
var puppeteer_utils_js = require('../puppeteer_utils.js');
var utilsBrowser_js = require('../utils-browser.js');
var sehatindonesiakuData_js = require('./sehatindonesiaku-data.js');
var sehatindonesiakuErrors_js = require('./sehatindonesiaku-errors.js');
var sehatindonesiakuUtils_js = require('./sehatindonesiaku-utils.js');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var fs__default = /*#__PURE__*/_interopDefault(fs);
var minimist__default = /*#__PURE__*/_interopDefault(minimist);

const args = minimist__default.default(process.argv.slice(2), {
  boolean: ["help", "single", "shuffle"],
  alias: { h: "help", s: "single", sh: "shuffle" }
});
function showHelp() {
  const [node, script] = process.argv;
  console.log(`[hadir] Usage: ${sbgUtility.normalizePathUnix(node)} ${sbgUtility.normalizePathUnix(script)} [options]`);
  console.log("[hadir]", "");
  console.log("[hadir]", "Options:");
  console.log("[hadir]", "  -h, --help     Show help");
  console.log("[hadir]", "  -s, --single   Process a single item");
  console.log("[hadir]", "  -sh, --shuffle      Shuffle the order of data items before processing");
}
if (process.argv.some((arg) => /sehatindonesiaku-kehadiran\.(cjs|js|mjs|ts)$/i.test(arg))) {
  (async () => {
    if (args.h || args.help) {
      showHelp();
      return;
    }
    let db;
    try {
      db = await sehatindonesiakuData_js.getSehatIndonesiaKuDb();
      await main(db);
    } finally {
      if (db) await db.close();
    }
  })();
}
async function main(db) {
  var _a;
  const puppeteer = await puppeteer_utils_js.getPuppeteer();
  let allData = await getData(db);
  if (args.shuffle || args.sh) {
    allData = sbgUtility.array_shuffle(allData);
  }
  if (args.single || args.s) {
    if (allData.length > 1) {
      allData.splice(1);
    }
  }
  console.log(`[hadir] Processing ${allData.length} items...`);
  for (const item of allData) {
    if (!item.nik) {
      console.error(`[hadir] Skipping item with missing NIK: ${JSON.stringify(item)}`);
      continue;
    }
    try {
      if ((await puppeteer.browser.pages()).length > 3) {
        const pages = await puppeteer.browser.pages();
        await pages[0].close();
      }
      await processData(await puppeteer.browser.newPage(), item, db);
    } catch (e) {
      if (e instanceof sehatindonesiakuErrors_js.UnauthorizedError) {
        console.error(
          "[hadir]",
          `${item.nik} - UnauthorizedError: Login required. Please login first using sehatindonesiaku-login. (close browser and rerun the script after login)`
        );
        break;
      }
      if (e instanceof sehatindonesiakuErrors_js.ErrorDataKehadiranNotFound) {
        console.error(`[hadir] ${item.nik} - Error: Data Kehadiran not found.`);
        const message = (((_a = await db.getLogById(item.nik)) == null ? void 0 : _a.message) ?? "").split(",");
        message.push("Data Kehadiran not found");
        await db.addLog({
          id: item.nik,
          data: { ...item, hadir: false },
          message: sbgUtility.array_unique(message).join(",")
        });
        continue;
      }
      console.error(`[hadir] ${item.nik} - Error processing data: ${e.message}`);
      console.error("[hadir]", e.stack);
    }
    if (args.single || args.s) break;
  }
  console.log("[hadir]", "All data processed. Closing browser...");
  await utilsBrowser_js.sleep(2e3);
  await puppeteer.browser.close();
  process.exit(0);
}
async function getExcelData(db) {
  const rawData = JSON.parse(fs__default.default.readFileSync(sehatindonesiakuData_js.sehatindonesiakuDataPath, "utf-8"));
  for (let i = rawData.length - 1; i >= 0; i--) {
    const item = rawData[i];
    if (item.nik && typeof item.nik === "string" && item.nik.trim().length === 16) {
      const dbItem = await db.getLogById(item.nik);
      let merged = { ...item };
      if (dbItem && dbItem.data) {
        merged = { ...merged, ...dbItem.data };
      }
      if (!("registered" in merged)) {
        rawData.splice(i, 1);
        console.log(`[hadir] ${item.nik}: ${item.nama} - Exclude unregistered`);
      }
    } else {
      rawData.splice(i, 1);
    }
  }
  return rawData;
}
async function getData(db, options) {
  const defaultOptions = { shuffle: false, single: false };
  options = { ...defaultOptions, ...options };
  const data = await getExcelData(db);
  console.log(`[hadir] Total data items retrieved: ${data.length}`);
  let filtered = data.filter((item) => {
    if (!item || typeof item.nik !== "string" || item.nik.length === 0) return false;
    if (!("hadir" in item)) return true;
    return false;
  });
  console.log(`[hadir] Total filtered data items: ${filtered.length}`);
  if (options.shuffle) {
    filtered = sbgUtility.array_shuffle(filtered);
  }
  if (options.single) {
    return filtered.slice(0, 1);
  }
  return filtered;
}
async function processData(page, item, db) {
  var _a;
  const isLoggedIn = await sehatindonesiakuUtils_js.enterSehatIndonesiaKu(page);
  if (!isLoggedIn) throw new sehatindonesiakuErrors_js.UnauthorizedError();
  await page.goto("https://sehatindonesiaku.kemkes.go.id/ckg-pendaftaran-individu", { waitUntil: "networkidle2" });
  await puppeteer_utils_js.waitForDomStable(page, 2e3, 5e3);
  await searchNik(page, item.nik);
  const isNoDataFound = await page.evaluate(() => {
    const el = document.querySelectorAll(".table-individu-terdaftar .font-bold");
    if (el.length === 0) return false;
    return Array.from(el).some(
      (item2) => item2.innerText.trim().toLowerCase() === "data tidak ditemukan"
    );
  });
  console.log(`[hadir] ${item.nik} - isNoDataFound: ${isNoDataFound}`);
  if (isNoDataFound) {
    throw new sehatindonesiakuErrors_js.ErrorDataKehadiranNotFound(item.nik);
  }
  if (await checkAlreadyHadir(page, item, db)) {
    return;
  }
  if (!await puppeteer_utils_js.clickElementByText(page, "button.w-fill", "Konfirmasi Hadir")) {
    throw new puppeteerErrors_cjs.ElementNotFoundError("Konfirmasi Hadir button not found or not clickable");
  }
  await puppeteer_utils_js.waitForDomStable(page, 2e3, 1e4);
  await utilsBrowser_js.sleep(1e3);
  console.log(`[hadir] ${item.nik} - checking hadir checkbox`);
  let checkboxFound = false;
  for (const verifyCheckboxSelector of ["div#verify", '[name="verify"]']) {
    if (await puppeteer_utils_js.isElementExist(page, verifyCheckboxSelector, { visible: true })) {
      const el = await page.evaluateHandle((selector) => {
        const checkbox = document.querySelector(selector);
        if (checkbox) {
          checkbox.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        }
        return checkbox;
      }, verifyCheckboxSelector);
      await el.click();
      await puppeteer_utils_js.waitForDomStable(page, 2e3, 1e4);
      checkboxFound = true;
      break;
    } else {
      console.log(`[hadir] ${item.nik} - ${verifyCheckboxSelector} checkbox not found`);
    }
  }
  if (!checkboxFound) {
    throw new puppeteerErrors_cjs.ElementNotFoundError("Checkbox verify not found");
  }
  await puppeteer_utils_js.clickElementByText(page, "button.w-fill", "Hadir");
  await puppeteer_utils_js.waitForDomStable(page, 2e3, 1e4);
  await puppeteer_utils_js.clickElementByText(page, "div.flex.flex-row.justify-center.gap-2", "Tutup");
  await puppeteer_utils_js.waitForDomStable(page, 2e3, 1e4);
  console.log(`[hadir] ${item.nik} - hadir confirmed`);
  const message = (((_a = await db.getLogById(item.nik)) == null ? void 0 : _a.message) ?? "").split(",");
  message.push("Data hadir confirmed");
  await db.addLog({
    id: item.nik,
    data: { ...item, hadir: true },
    message: sbgUtility.array_unique(message).join(",")
  });
}
async function searchNik(page, nik) {
  console.log(`[hadir] ${nik} - change search type to NIK`);
  await puppeteer_utils_js.clickElementByText(page, "div.cursor-pointer", "Nomor Tiket");
  await utilsBrowser_js.sleep(200);
  await puppeteer_utils_js.clickElementByText(page, "div.cursor-pointer", "NIK");
  await page.focus("#nik");
  await page.type("#nik", nik, { delay: 100 });
  await page.keyboard.press("Enter");
  await puppeteer_utils_js.waitForDomStable(page, 2e3, 1e4);
  await utilsBrowser_js.sleep(1e3);
}
async function checkAlreadyHadir(page, item, db) {
  var _a;
  if (await puppeteer_utils_js.anyElementWithTextExists(page, "div.w-full", "Sudah Hadir")) {
    console.log(`[hadir] ${item.nik} - already marked as hadir`);
    const message = (((_a = await db.getLogById(item.nik)) == null ? void 0 : _a.message) ?? "").split(",");
    message.push("Data sudah hadir");
    await db.addLog({
      id: item.nik,
      data: { ...item, hadir: true },
      message: sbgUtility.array_unique(message).join(",")
    });
    return true;
  }
  return false;
}

exports.checkAlreadyHadir = checkAlreadyHadir;
exports.getKehadiranData = getData;
exports.mainKehadiran = main;
exports.processKehadiranData = processData;
exports.searchNik = searchNik;
exports.showHelp = showHelp;
//# sourceMappingURL=sehatindonesiaku-kehadiran.cjs.map
//# sourceMappingURL=sehatindonesiaku-kehadiran.cjs.map