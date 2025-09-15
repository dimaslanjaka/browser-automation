'use strict';

require('../chunk-4IBVXDKH.cjs');
var crossSpawn = require('cross-spawn');
var dotenv = require('dotenv');
var moment = require('moment');
var nikParse = require('nik-parser-jurusid');
var path = require('path');
var nominatim_js = require('../address/nominatim.js');
var beep_js = require('../beep.js');
var fetchXlsxData3_js = require('../fetchXlsxData3.js');
var puppeteer_utils_js = require('../puppeteer_utils.js');
var skrin_puppeteer_js = require('../skrin_puppeteer.js');
var skrin_utils_js = require('../skrin_utils.js');
var utils_js = require('../utils.js');
var string_js = require('../utils/string.js');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var dotenv__default = /*#__PURE__*/_interopDefault(dotenv);
var moment__default = /*#__PURE__*/_interopDefault(moment);
var nikParse__default = /*#__PURE__*/_interopDefault(nikParse);
var path__default = /*#__PURE__*/_interopDefault(path);

dotenv__default.default.config({ path: path__default.default.join(process.cwd(), ".env") });
async function buildHtmlLog() {
  await crossSpawn.spawnAsync("node", [path__default.default.resolve(process.cwd(), "log-builder.js")], {
    cwd: process.cwd(),
    stdio: "inherit"
  });
  await crossSpawn.spawnAsync("node", [path__default.default.resolve(process.cwd(), "log-analyzer.js")], {
    cwd: process.cwd(),
    stdio: "inherit"
  });
}
async function processData(browser, data) {
  const page = await browser.newPage();
  const pages = await browser.pages();
  if (pages.length > 3) {
    await pages[0].close();
  }
  try {
    await skrin_puppeteer_js.enterSkriningPage(page);
  } catch (e) {
    await beep_js.playMp3FromUrl("https://assets.mixkit.co/active_storage/sfx/1084/1084.wav").catch(console.error);
    console.error("Error navigating to skrining page:", e.message);
    return processData(browser, data);
  }
  await page.waitForSelector("#nik", { visible: true });
  await utils_js.sleep(3e3);
  if (!data) {
    throw new Error("No more data to process.");
  }
  if (!data.parsed_nik || typeof data.parsed_nik === "object" && Object.keys(data.parsed_nik).length === 0) {
    console.log(`Parsed NIK is empty for NIK: ${data.nik}, reparsing...`);
    data.parsed_nik = nikParse__default.default(data.nik).data;
  }
  console.log("Processing:", data);
  if (!`${data.tanggal}`.includes("/") || !data.tanggal || data.tanggal.length < 8) {
    await browser.close();
    throw new Error(`INVALID DATE ${JSON.stringify(data, null, 2)}`);
  }
  const parseTanggal = moment__default.default(data.tanggal, "DD/MM/YYYY", true);
  if (!parseTanggal.isValid()) {
    await browser.close();
    throw new Error(`INVALID DATE ${JSON.stringify(data, null, 2)}`);
  }
  if (parseTanggal.day() === 0) {
    await browser.close();
    throw new Error(`SUNDAY DATE NOT ALLOWED: ${data.tanggal}`);
  }
  await page.$eval("#dt_tgl_skrining", (el) => el.removeAttribute("readonly"));
  await puppeteer_utils_js.typeAndTrigger(page, "#dt_tgl_skrining", data.tanggal);
  await page.$eval("#dt_tgl_skrining", (el) => el.setAttribute("readonly", "true"));
  await puppeteer_utils_js.typeAndTrigger(page, 'input[name="metode_id_input"]', "Tunggal");
  await puppeteer_utils_js.typeAndTrigger(page, 'input[name="tempat_skrining_id_input"]', "Puskesmas");
  if (data.nik.length < 16) {
    console.error("Skipping due NIK length invalid, should be 16 digits.");
    utils_js.appendLog(data, "Invalid Data");
    buildHtmlLog();
    return {
      status: "error",
      reason: "invalid_nik_length",
      description: "Skipping due NIK length invalid, should be 16 digits."
    };
  }
  await puppeteer_utils_js.typeAndTrigger(page, "#nik", utils_js.getNumbersOnly(data.nik));
  await utils_js.sleep(5e3);
  try {
    await page.waitForSelector(".k-widget.k-window.k-window-maximized", { timeout: 5e3 });
  } catch (_e) {
  }
  try {
    await page.waitForSelector('[aria-labelledby="dialogconfirm_wnd_title"]', { visible: true, timeout: 5e3 });
  } catch (_e) {
  }
  console.log("Is NIK error notification visible:", await skrin_utils_js.isNikErrorVisible(page));
  if (await skrin_utils_js.isNikErrorVisible(page)) {
    utils_js.waitEnter("Please check NIK error notification. Press Enter to continue...");
    throw new Error("NIK error notification visible, please re-check. Aborting...");
  }
  console.log("Identity modal is visible:", await skrin_utils_js.isIdentityModalVisible(page));
  if (await skrin_utils_js.isIdentityModalVisible(page)) {
    await skrin_utils_js.confirmIdentityModal(page);
  }
  const isNikNotFound = await skrin_utils_js.isNIKNotFoundModalVisible(page);
  console.log("Is NIK not found modal visible:", isNikNotFound);
  if (isNikNotFound) {
    const shouldClickYes = await page.evaluate(() => {
      const dialog = document.querySelector("#dialogconfirm");
      if (!dialog) return false;
      const text = (dialog.innerText || dialog.textContent || "").toLowerCase();
      return text.includes("access to resources is temporary closed".toLowerCase()) && text.includes("Apakah Anda akan melanjutkan penginputan manual?".toLowerCase());
    });
    if (shouldClickYes) {
      await page.click("#yesButton");
      if (!data.nama || data.nama.length === 0) {
        throw new Error("\u274C Failed to take the patient's name");
      }
      await puppeteer_utils_js.typeAndTrigger(page, '#field_item_nama_peserta input[type="text"]', data.nama);
      if (!data.parsed_nik) {
        throw new Error("\u274C Failed to parse NIK data");
      }
      const parsed_nik_gender = data.parsed_nik.kelamin.toLowerCase() == "laki-laki" ? "Laki-laki" : "Perempuan";
      console.log(`Gender ${parsed_nik_gender} detected from NIK`);
      await puppeteer_utils_js.typeAndTrigger(page, '#field_item_jenis_kelamin_id input[type="text"]', parsed_nik_gender);
      const parsedLahir = moment__default.default(data.tgl_lahir, ["DD/MM/YYYY", "YYYY-MM-DD"], true);
      if (!parsedLahir.isValid()) {
        throw new Error(`\u274C Invalid birth date format from NIK, expected DD/MM/YYYY, got: ${data.tgl_lahir}`);
      }
      await puppeteer_utils_js.typeAndTrigger(page, '#field_item_tgl_lahir input[type="text"]', parsedLahir.format("DD/MM/YYYY"));
      if (!data.alamat || data.alamat.length === 0) {
        throw new Error("\u274C Failed to take the patient's address");
      }
      const keywordAddr = `${data.alamat} Surabaya, Jawa Timur`.trim();
      const address = await nominatim_js.geocodeWithNominatim(keywordAddr);
      data._address = address;
      let { kotakab = "", kecamatan = "", provinsi = "", kelurahan = "" } = data.parsed_nik;
      if (kotakab.length === 0 || kecamatan.length === 0 || provinsi.length === 0) {
        console.log(`Fetching address from Nominatim for: ${keywordAddr}`);
        console.log("Nominatim result:", address);
        const addr = address.address || {};
        if (kelurahan.length === 0) kelurahan = addr.village || addr.hamlet || "";
        if (kecamatan.length === 0) kecamatan = addr.suburb || addr.city_district || "";
        if (kotakab.length === 0) kotakab = addr.city || addr.town || addr.village || "Kota Surabaya";
        if (provinsi.length === 0) provinsi = addr.state || addr.province || "Jawa Timur";
        if (kotakab.toLowerCase().includes("surabaya")) {
          kotakab = "Kota Surabaya";
        }
        if (kotakab.length === 0 || kecamatan.length === 0) {
          throw new Error("\u274C Failed to take the patient's city or town");
        }
      }
      await puppeteer_utils_js.typeAndTrigger(page, '#field_item_provinsi_ktp_id input[type="text"]', string_js.ucwords(provinsi));
      await puppeteer_utils_js.typeAndTrigger(page, '#field_item_kabupaten_ktp_id input[type="text"]', string_js.ucwords(kotakab));
      await puppeteer_utils_js.typeAndTrigger(page, '#field_item_kecamatan_ktp_id input[type="text"]', string_js.ucwords(kecamatan));
      await puppeteer_utils_js.typeAndTrigger(page, '#field_item_kelurahan_ktp_id input[type="text"]', string_js.ucwords(kelurahan));
      await puppeteer_utils_js.typeAndTrigger(page, '#field_item_alamat_ktp textarea[type="text"]', data.alamat);
    } else {
      return {
        status: "error",
        reason: "data_not_found",
        description: "Skipping due data not found"
      };
    }
  }
  const nama = await page.evaluate(() => {
    var _a;
    return (_a = document.querySelector('input[name="nama_peserta"]')) == null ? void 0 : _a.value;
  });
  data.nama = `${nama}`.trim();
  if (`${data.nama}`.trim().length === 0) {
    throw new Error("\u274C Failed to take the patient's name");
  }
  const { gender, age, birthDate, location } = await skrin_utils_js.getPersonInfo(page);
  const { province, city } = location;
  data.gender = gender;
  data.tgl_lahir = birthDate;
  data.umur = age;
  console.log("Jenis kelamin:", gender, "Umur:", age, "tahun");
  if (!gender || isNaN(age)) {
    throw new Error("Invalid input: Gender or age is missing/invalid.");
  }
  console.log(`Provinsi: ${province}`, province.length == 0 ? "(empty)" : "");
  if (province.length == 0) {
    await puppeteer_utils_js.typeAndTrigger(page, '#field_item_provinsi_ktp_id input[type="text"]', "Jawa Timur");
  }
  console.log(`Kabupaten/Kota: ${city}`, city.length == 0 ? "(empty)" : "");
  if (city.length == 0) {
    await puppeteer_utils_js.typeAndTrigger(page, '#field_item_kabupaten_ktp_id input[type="text"]', "Kota Surabaya");
  }
  data.pekerjaan_original = data.pekerjaan;
  const job = data.pekerjaan.trim().toLowerCase();
  const jobMappings = [
    { pattern: /rumah\s*tangga|irt/, value: "IRT" },
    { pattern: /swasta|pedagang/, value: "Wiraswasta" },
    { pattern: /tukang|buruh/, value: "Buruh " },
    { pattern: /tidak\s*bekerja|belum\s*bekerja|pensiun/, value: "Tidak Bekerja" },
    { pattern: /pegawai\s*negeri(\s*sipil)?|pegawai\s*negri/, value: "PNS " },
    { pattern: /guru|dosen/, value: "Guru/ Dosen" },
    { pattern: /perawat|dokter/, value: "Tenaga Profesional Medis " },
    { pattern: /pengacara|wartawan/, value: "Tenaga Profesional Non Medis " },
    { pattern: /pelajar|siswa|siswi|sekolah/, value: "Pelajar/ Mahasiswa" },
    { pattern: /s[o,u]pir/, value: "Sopir " }
  ];
  let jobMatched = false;
  for (const { pattern, value } of jobMappings) {
    if (pattern.test(job)) {
      data.pekerjaan = value;
      jobMatched = true;
      break;
    }
  }
  if (!jobMatched) {
    if (job === "unspecified" || job === "lainnya" || job.length === 0) {
      if (age > 55 || age <= 20) {
        data.pekerjaan = "Tidak Bekerja";
      } else {
        data.pekerjaan = gender.toLowerCase() === "perempuan" ? "IRT" : "Wiraswasta";
      }
    } else {
      await utils_js.waitEnter(
        `Undefined Job for data: ${JSON.stringify(data)}. Please fix and press enter to continue auto fill.`
      );
    }
  }
  console.log(`Pekerjaan: ${data.pekerjaan}`);
  await puppeteer_utils_js.typeAndTrigger(page, 'input[name="pekerjaan_id_input"]', data.pekerjaan);
  if (!data.bb || !data.tb) {
    await skrin_utils_js.fixTbAndBb(page, age, gender);
  } else {
    await page.focus('#field_item_berat_badan input[type="text"]');
    await page.type('#field_item_berat_badan input[type="text"]', utils_js.extractNumericWithComma(data.bb), { delay: 100 });
    await page.focus('#field_item_tinggi_badan input[type="text"]');
    await page.type('#field_item_tinggi_badan input[type="text"]', utils_js.extractNumericWithComma(data.tb), { delay: 100 });
  }
  await puppeteer_utils_js.typeAndTrigger(page, '#field_item_riwayat_kontak_tb_id input[type="text"]', "Tidak");
  await puppeteer_utils_js.typeAndTrigger(page, '#field_item_risiko_1_id input[type="text"]', "Tidak");
  await puppeteer_utils_js.typeAndTrigger(page, '#field_item_risiko_4_id input[type="text"]', "Tidak");
  await puppeteer_utils_js.typeAndTrigger(page, '#field_item_risiko_5_id input[type="text"]', "Tidak");
  if (data.diabetes) {
    await puppeteer_utils_js.typeAndTrigger(page, '#field_item_risiko_6_id input[type="text"]', "Ya");
  } else {
    await puppeteer_utils_js.typeAndTrigger(page, '#field_item_risiko_6_id input[type="text"]', "Tidak");
  }
  await puppeteer_utils_js.typeAndTrigger(page, '#field_item_risiko_7_id input[type="text"]', "Tidak");
  if (gender.toLowerCase().trim() == "perempuan") {
    await puppeteer_utils_js.typeAndTrigger(page, '#field_item_risiko_9_id input[type="text"]', "Tidak");
  }
  await puppeteer_utils_js.typeAndTrigger(page, '#field_item_risiko_10_id input[type="text"]', "Tidak");
  await puppeteer_utils_js.typeAndTrigger(page, '#field_item_risiko_11_id input[type="text"]', "Tidak");
  await puppeteer_utils_js.typeAndTrigger(page, '#field_item_gejala_2_3_id input[type="text"]', "Tidak");
  await puppeteer_utils_js.typeAndTrigger(page, '#field_item_gejala_2_4_id input[type="text"]', "Tidak");
  await puppeteer_utils_js.typeAndTrigger(page, '#field_item_gejala_2_5_id input[type="text"]', "Tidak");
  await puppeteer_utils_js.typeAndTrigger(page, '#field_item_gejala_6_id input[type="text"]', "Tidak");
  await puppeteer_utils_js.typeAndTrigger(page, '#field_item_cxr_pemeriksaan_id input[type="text"]', "Tidak");
  if (age < 18) {
    const gejalaBalitaSelectors = [
      '#field_item_gejala_1_1_id input[type="text"]',
      '#field_item_gejala_1_3_id input[type="text"]',
      '#form_item_gejala_1_4_id input[type="text"]',
      '#field_item_gejala_1_5_id input[type="text"]'
    ];
    for (const gejalaBalitaSelector of gejalaBalitaSelectors) {
      if (puppeteer_utils_js.isElementExist(page, gejalaBalitaSelector)) {
        console.log(
          `Gejala balita ${gejalaBalitaSelector} is visible ${await puppeteer_utils_js.isElementVisible(page, gejalaBalitaSelector)}`
        );
        if (await puppeteer_utils_js.isElementVisible(page, gejalaBalitaSelector)) {
          await puppeteer_utils_js.typeAndTrigger(page, gejalaBalitaSelector, "Tidak");
          await utils_js.sleep(200);
        }
      }
    }
  }
  await page.keyboard.press("Tab");
  if (!data.batuk) {
    await puppeteer_utils_js.typeAndTrigger(page, '#field_item_gejala_2_1_id input[type="text"]', "Tidak");
  } else {
    let keteranganBatuk = data.batuk.replace(/ya,/, "batuk");
    if (/\d/m.test(keteranganBatuk)) {
      await puppeteer_utils_js.typeAndTrigger(page, "#field_item_keterangan textarea", keteranganBatuk);
      await utils_js.waitEnter("Please fix data batuk/demam. Press Enter to continue...");
    }
  }
  await utils_js.sleep(2e3);
  while (await skrin_utils_js.isIdentityModalVisible(page)) {
    await skrin_utils_js.confirmIdentityModal(page);
    await utils_js.sleep(1e3);
    if (await skrin_utils_js.isIdentityModalVisible(page)) {
      await utils_js.waitEnter("Please check identity modal. Press Enter to continue...");
    }
  }
  while (await skrin_utils_js.isInvalidAlertVisible(page)) {
    await puppeteer_utils_js.typeAndTrigger(page, 'input[name="metode_id_input"]', "Tunggal");
    await puppeteer_utils_js.typeAndTrigger(page, 'input[name="tempat_skrining_id_input"]', "Puskesmas");
    await puppeteer_utils_js.typeAndTrigger(page, 'input[name="pekerjaan_id_input"]', data.pekerjaan);
    if (await skrin_utils_js.isInvalidAlertVisible(page)) {
      console.warn("\u26A0\uFE0F Invalid alert detected for the following data:");
      console.dir(data, { depth: null });
      await utils_js.waitEnter("Please review the alert and press Enter to continue...");
    }
  }
  let hasSubmitted;
  const identityModalVisible = await skrin_utils_js.isIdentityModalVisible(page);
  const invalidAlertVisible = await skrin_utils_js.isInvalidAlertVisible(page);
  const nikErrorVisible = await skrin_utils_js.isNikErrorVisible(page);
  const nikNotFoundModalVisible = await skrin_utils_js.isNIKNotFoundModalVisible(page);
  console.log("identityModalVisible:", identityModalVisible);
  console.log("invalidAlertVisible:", invalidAlertVisible);
  console.log("nikErrorVisible:", nikErrorVisible);
  console.log("nikNotFoundModalVisible:", nikNotFoundModalVisible);
  const isAllowedToSubmit = !identityModalVisible && !invalidAlertVisible && !nikErrorVisible && !nikNotFoundModalVisible;
  console.log("isAllowedToSubmit:", isAllowedToSubmit);
  if (isAllowedToSubmit) {
    console.log("Clicking the save button...");
    await page.$eval("#save", (el) => el.scrollIntoView());
    await page.evaluate(() => {
      const el = document.querySelector("#save");
      if (el) {
        el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      }
    });
    await utils_js.sleep(1e3);
    try {
      await page.waitForSelector("#yesButton", { visible: true });
      await page.click("#yesButton");
    } catch (_) {
      utils_js.waitEnter(
        "Failed to click #yesButton for confirmation modal. Please click the button manually, then press Enter to continue..."
      );
    }
    await utils_js.sleep(1e3);
    while (true) {
      const isSuccessVisible = await skrin_utils_js.isSuccessNotificationVisible(page);
      if (isSuccessVisible) {
        console.log("\u2705 Success notification is visible");
        break;
      }
      await new Promise((r) => setTimeout(r, 1e3));
      if (Date.now() % 5e3 < 1e3) {
        console.log("Waiting for success notification modal to be visible...");
      }
    }
    hasSubmitted = true;
  } else {
    hasSubmitted = false;
  }
  if (hasSubmitted) {
    console.log("\u2705	Data submitted successfully:", data);
  } else {
    console.warn("\u26A0\uFE0F	Data processed but not submitted:", data);
    await utils_js.waitEnter("Press Enter to continue...");
  }
  return {
    status: "success",
    data
  };
}
async function runEntrySkrining(dataCallback = (data) => data) {
  const datas = await fetchXlsxData3_js.fetchXlsxData3(process.env.index_start, process.env.index_end);
  const puppeteer = await puppeteer_utils_js.getPuppeteer();
  let page = puppeteer.page;
  const browser = puppeteer.browser;
  await skrin_puppeteer_js.skrinLogin(page);
  while (datas.length > 0) {
    let data = await dataCallback(datas.shift());
    const result = await processData(browser, data);
    if (result.status == "error") {
      console.error(Object.assign(result, { data }));
      break;
    } else {
      utils_js.appendLog(data);
      await buildHtmlLog();
    }
  }
  console.log("All data processed.");
  buildHtmlLog();
  await browser.close();
}

exports.processData = processData;
exports.runEntrySkrining = runEntrySkrining;
//# sourceMappingURL=skrin.cjs.map
//# sourceMappingURL=skrin.cjs.map