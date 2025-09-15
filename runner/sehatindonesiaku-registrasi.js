import '../chunk-BUSYA2B4.js';
import ansiColors from 'ansi-colors';
import 'dotenv/config.js';
import minimist from 'minimist';
import moment from 'moment';
import { normalizePathUnix, array_shuffle, array_unique } from 'sbg-utility';
import { getPuppeteer, waitForDomStable, anyElementWithTextExists } from '../puppeteer_utils.js';
import { getSehatIndonesiaKuDb, getExcelData, fixKemkesDataItem } from './sehatindonesiaku-data.js';
import { DataTidakSesuaiKTPError, PembatasanUmurError, UnauthorizedError, TanggalPemeriksaanError, KuotaHabisError } from './sehatindonesiaku-errors.js';
import { commonInput, selectTanggalLahir, selectGender, selectPekerjaan, clickAddressModal, clickProvinsi, clickKabupatenKota, clickKecamatan, clickKelurahan, clickSubmit, isSpecificModalVisible, clickPilihButton, clickDaftarkanDenganNIK, handleKuotaHabisModal } from './sehatindonesiaku-register-utils.js';
import { enterSehatIndonesiaKu, clickDaftarBaru, selectDayFromCalendar, clickKembali } from './sehatindonesiaku-utils.js';

const cliArgs = minimist(process.argv.slice(2), {
  alias: { h: "help", s: "single", sh: "shuffle" },
  string: ["nik"]
});
const isSingleData = cliArgs.single || cliArgs.s || false;
const isShuffle = cliArgs.shuffle || cliArgs.sh || false;
function parseNikArg(arg) {
  if (!arg) return;
  if (typeof arg === "string" || typeof arg === "number") {
    return String(arg).split(",").map((n) => n.trim()).filter(Boolean);
  }
  if (Array.isArray(arg)) {
    return arg.flatMap((n) => String(n).split(",")).map((n) => n.trim()).filter(Boolean);
  }
  return;
}
async function main() {
  var _a;
  let needLogin = false;
  const db = await getSehatIndonesiaKuDb();
  const { browser } = await getPuppeteer();
  const nikList = parseNikArg(cliArgs.nik);
  let allData = await getData(db, { nik: nikList });
  if (isShuffle) allData = array_shuffle(allData);
  for (const item of allData) {
    try {
      await processData(browser, item, db);
    } catch (e) {
      const message = (((_a = await db.getLogById(item.nik)) == null ? void 0 : _a.message) ?? "").split(",");
      if (e instanceof DataTidakSesuaiKTPError) {
        console.warn(`[registrasi] ${item.nik} - ${ansiColors.red("Data tidak sesuai KTP")}`);
        message.push("Data tidak sesuai KTP");
        await db.addLog({
          id: item.nik,
          message: array_unique(message).join(","),
          data: { registered: false, ...item }
        });
        continue;
      } else if (e instanceof PembatasanUmurError) {
        console.warn(`[registrasi] Pembatasan umur untuk NIK ${item.nik}:`);
        message.push("Pembatasan umur");
        await db.addLog({
          id: item.nik,
          message: array_unique(message).join(","),
          data: { registered: false, ...item }
        });
        continue;
      } else if (e instanceof UnauthorizedError) {
        needLogin = true;
        console.warn(
          `[registrasi] ${ansiColors.redBright("Login required")}, please ${ansiColors.bold("login manually")} from opened browser. (close browser manual)`
        );
        break;
      } else if (e instanceof TanggalPemeriksaanError) {
        console.warn(
          `[registrasi] ${item.nik} - ${ansiColors.red("Tanggal Pemeriksaan tidak valid")}: ${item.tanggal_pemeriksaan}`
        );
        message.push(`Tanggal Pemeriksaan tidak valid. ${item.tanggal_pemeriksaan}`);
        await db.addLog({
          id: item.nik,
          message: array_unique(message).join(","),
          data: { registered: false, ...item }
        });
        continue;
      }
    }
    if (isSingleData) break;
  }
  if (needLogin) {
    return;
  }
  console.log("[registrasi] All data processed. Closing browser...");
  await browser.close();
  await db.close();
  process.exit(0);
}
async function processData(browserOrPage, item, db, options = {}) {
  var _a, _b;
  const provinsi = options.provinsi ?? "DKI Jakarta";
  const kabupaten = options.kabupaten ?? "Kota Adm. Jakarta Barat";
  const kecamatan = options.kecamatan ?? "Kebon Jeruk";
  const kelurahan = options.kelurahan ?? "Kebon Jeruk";
  item = fixKemkesDataItem(item);
  const pages = typeof browserOrPage.browser === "function" ? await browserOrPage.browser().pages() : await browserOrPage.pages();
  if (pages.length > 5) {
    console.log(`[registrasi] Closing excess tab, current open tabs: ${pages.length}`);
    await pages[0].close();
  }
  console.log(`[registrasi] Processing data`, item);
  const page = typeof browserOrPage.browser === "function" ? await browserOrPage.browser().newPage() : await browserOrPage.newPage();
  const isLoggedIn = await enterSehatIndonesiaKu(page);
  if (!isLoggedIn) throw new UnauthorizedError();
  await page.goto("https://sehatindonesiaku.kemkes.go.id/ckg-pendaftaran-individu", { waitUntil: "networkidle2" });
  await waitForDomStable(page, 2e3, 6e3);
  await clickDaftarBaru(page);
  await waitForDomStable(page, 2e3, 6e3);
  console.log(`[registrasi] ${item.nik} - Filling common input fields...`);
  await commonInput(page, item);
  await waitForDomStable(page, 2e3, 6e3);
  console.log(`[registrasi] ${item.nik} - Selecting date of birth...`);
  await selectTanggalLahir(page, item);
  await waitForDomStable(page, 2e3, 6e3);
  console.log(`[registrasi] ${item.nik} - Selecting gender...`);
  await selectGender(page, item);
  await waitForDomStable(page, 2e3, 6e3);
  console.log(`[registrasi] ${item.nik} - Selecting pekerjaan...`);
  await selectPekerjaan(page, item);
  await waitForDomStable(page, 2e3, 6e3);
  console.log(`[registrasi] ${item.nik} - Selecting address...`);
  await clickAddressModal(page);
  await clickProvinsi(page, provinsi);
  await clickKabupatenKota(page, kabupaten);
  await clickKecamatan(page, kecamatan);
  await clickKelurahan(page, kelurahan);
  await waitForDomStable(page, 2e3, 6e3);
  console.log(`[registrasi] ${item.nik} - Selecting tanggal pemeriksaan...`);
  if (!item.tanggal_pemeriksaan) {
    item.tanggal_pemeriksaan = moment().format("DD/MM/YYYY");
    console.log(
      `[registrasi] ${item.nik} - tanggal_pemeriksaan is empty, defaulting to today: ${item.tanggal_pemeriksaan}`
    );
  }
  if (!await selectDayFromCalendar(page, item.tanggal_pemeriksaan)) {
    throw new TanggalPemeriksaanError(item.nik);
  }
  await waitForDomStable(page, 2e3, 6e3);
  console.log(`[registrasi] ${item.nik} - Submitting form...`);
  await clickSubmit(page);
  await waitForDomStable(page, 2e3, 6e3);
  await isPembatasanUmurVisible(page, item);
  await kuotaHabisHandler(page, item);
  console.log(`[registrasi] ${item.nik} - Handling formulir pendaftaran modal...`);
  const isModalRegistrationVisible = await isSpecificModalVisible(page, "formulir pendaftaran");
  console.log(`[registrasi] Modal formulir pendaftaran visible: ${isModalRegistrationVisible}`);
  if (isModalRegistrationVisible) {
    await isPembatasanUmurVisible(page, item);
    console.log(`[registrasi] ${item.nik} - Clicking "Pilih" button inside individu terdaftar table...`);
    await clickPilihButton(page);
    await waitForDomStable(page, 2e3, 6e3);
    console.log(`[registrasi] ${item.nik} - Clicking "Daftarkan dengan NIK" button...`);
    await clickDaftarkanDenganNIK(page);
    await waitForDomStable(page, 2e3, 6e3);
    await kuotaHabisHandler(page, item);
  }
  if (await isSuccessModalVisible(page)) {
    console.log(`[registrasi] ${item.nik} - ${ansiColors.green("Data registered successfully!")}`);
    const message = (((_a = await db.getLogById(item.nik)) == null ? void 0 : _a.message) ?? "").split(",");
    message.push("Data registered successfully");
    await db.addLog({
      id: item.nik,
      data: { ...item, registered: true },
      message: array_unique(message).join(",")
    });
    return;
  }
  if (await isSpecificModalVisible(page, "Peserta Menerima Pemeriksaan")) {
    console.log(`[registrasi] ${item.nik} - Peserta Menerima Pemeriksaan modal is visible.`);
    await clickKembali(page);
    const message = (((_b = await db.getLogById(item.nik)) == null ? void 0 : _b.message) ?? "").split(",");
    message.push("Peserta Sudah Menerima Pemeriksaan");
    await db.addLog({
      id: item.nik,
      data: { ...item, registered: true },
      message: array_unique(message).join(",")
    });
    return;
  }
  if (await isSpecificModalVisible(page, "Data belum sesuai KTP")) {
    console.log(`[registrasi] ${item.nik} - Data belum sesuai KTP modal is visible.`);
    throw new DataTidakSesuaiKTPError(item.nik);
  }
}
async function kuotaHabisHandler(page, item) {
  const isKuotaHabisVisible = await isSpecificModalVisible(page, "Kuota pemeriksaan habis");
  console.log(`[registrasi] Modal "Kuota pemeriksaan habis" visible: ${isKuotaHabisVisible}`);
  if (isKuotaHabisVisible) {
    const isClicked = await handleKuotaHabisModal(page);
    if (!isClicked) throw new KuotaHabisError(item.nik);
    await waitForDomStable(page, 2e3, 6e3);
  }
}
async function isPembatasanUmurVisible(page, item) {
  const isAgeLimitCheckDisplayed = await anyElementWithTextExists(page, "div.pb-2", "Pembatasan Umur Pemeriksaan") || await isSpecificModalVisible(page, "Pembatasan Umur Pemeriksaan");
  console.log(`[registrasi] Is age limit check displayed: ${isAgeLimitCheckDisplayed}`);
  if (isAgeLimitCheckDisplayed) throw new PembatasanUmurError(item.nik);
}
async function isSuccessModalVisible(page) {
  const modals = await page.$$("div.p-2");
  for (const modal of modals) {
    const text = await page.evaluate((el) => el.innerText, modal);
    if (text.includes("Berhasil Daftar")) {
      const visible = await page.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
      }, modal);
      if (visible) return true;
    }
  }
  return false;
}
async function getData(db, options = {}) {
  var _a, _b;
  let rawData = await getExcelData();
  if ((_a = options.nik) == null ? void 0 : _a.length) {
    const nikSet = new Set(options.nik);
    rawData = rawData.filter((item) => nikSet.has(item.nik));
    if (options.debug) console.log(`[registrasi] Filtering rawData for NIK(s): ${options.nik.join(", ")}`);
  }
  const today = moment().startOf("day");
  const filtered = [];
  for (const item of rawData) {
    if (!item.nik || String(item.nik).trim().length === 0) {
      if (options.debug) console.log(`[registrasi] Skipping row for empty/invalid NIK:`, item);
      continue;
    }
    const dbItem = await db.getLogById(item.nik);
    Object.assign(item, (dbItem == null ? void 0 : dbItem.data) ?? {});
    if (!((_b = item.tanggal_pemeriksaan) == null ? void 0 : _b.trim())) {
      item.tanggal_pemeriksaan = moment().format("DD/MM/YYYY");
      if (options.debug) console.log(`[registrasi] Fixing empty tanggal_pemeriksaan for NIK: ${item.nik}`);
    }
    const pemeriksaanDate = moment(item.tanggal_pemeriksaan, "DD/MM/YYYY").startOf("day");
    if (pemeriksaanDate.isBefore(today)) {
      if (options.debug)
        console.log(
          `[registrasi] Skipping row for past tanggal_pemeriksaan: ${item.nik} - ${item.tanggal_pemeriksaan}`
        );
      continue;
    }
    if (Object.prototype.hasOwnProperty.call(item, "registered")) {
      if (options.debug) console.log(`[registrasi] Skipping row for registered property: ${item.nik}`);
      continue;
    }
    filtered.push(item);
  }
  return filtered;
}
function showHelp() {
  const [node, script] = process.argv;
  console.log("[registrasi] SehatIndonesiaku Kemkes CLI");
  console.log("[registrasi] ----------------------------");
  console.log(`[registrasi] Usage: ${normalizePathUnix(node)} ${normalizePathUnix(script)} [options]`);
  console.log("[registrasi]");
  console.log("[registrasi] Options:");
  console.log("[registrasi]   -h, --help        Show this help message and exit");
  console.log("[registrasi]   -s, --single      Process only one data item (first match or filtered by --nik)");
  console.log("[registrasi]   -sh, --shuffle    Shuffle data before processing");
  console.log("[registrasi]   --nik <NIK>       Process only data with specific NIK (useful with --single)");
  console.log("[registrasi]");
  console.log("[registrasi] Examples:");
  console.log(`[registrasi]   ${normalizePathUnix(node)} ${normalizePathUnix(script)} --help`);
  console.log(`[registrasi]   ${normalizePathUnix(node)} ${normalizePathUnix(script)} --single`);
  console.log(`[registrasi]   ${normalizePathUnix(node)} ${normalizePathUnix(script)} --nik 1234567890123456`);
  console.log(`[registrasi]   ${normalizePathUnix(node)} ${normalizePathUnix(script)} --single --nik 1234567890123456`);
  console.log(`[registrasi]   ${normalizePathUnix(node)} ${normalizePathUnix(script)} --shuffle`);
  console.log("[registrasi]");
  console.log("[registrasi] For more information, see the documentation or README.");
}
if (process.argv.some((arg) => /sehatindonesiaku-registrasi\.(js|ts|cjs|mjs)$/i.test(arg))) {
  (async () => {
    if (cliArgs.h || cliArgs.help) {
      showHelp();
      return;
    }
    await main();
  })();
}

export { getData as getRegistrasiData, isPembatasanUmurVisible, kuotaHabisHandler, main as mainRegistrasi, processData as processRegistrasiData, showHelp };
//# sourceMappingURL=sehatindonesiaku-registrasi.js.map
//# sourceMappingURL=sehatindonesiaku-registrasi.js.map