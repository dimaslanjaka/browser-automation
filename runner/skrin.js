import '../chunk-BUSYA2B4.js';
import { spawnAsync } from 'cross-spawn';
import dotenv from 'dotenv';
import moment from 'moment';
import nikParse from 'nik-parser-jurusid';
import path from 'path';
import { geocodeWithNominatim } from '../address/nominatim.js';
import { playMp3FromUrl } from '../beep.js';
import { fetchXlsxData3 } from '../fetchXlsxData3.js';
import { typeAndTrigger, isElementExist, isElementVisible, getPuppeteer } from '../puppeteer_utils.js';
import { enterSkriningPage, skrinLogin } from '../skrin_puppeteer.js';
import { isNikErrorVisible, isIdentityModalVisible, confirmIdentityModal, isNIKNotFoundModalVisible, getPersonInfo, fixTbAndBb, isInvalidAlertVisible, isSuccessNotificationVisible } from '../skrin_utils.js';
import { sleep, appendLog, getNumbersOnly, waitEnter, extractNumericWithComma } from '../utils.js';
import { ucwords } from '../utils/string.js';

dotenv.config({ path: path.join(process.cwd(), ".env") });
async function buildHtmlLog() {
  await spawnAsync("node", [path.resolve(process.cwd(), "log-builder.js")], {
    cwd: process.cwd(),
    stdio: "inherit"
  });
  await spawnAsync("node", [path.resolve(process.cwd(), "log-analyzer.js")], {
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
    await enterSkriningPage(page);
  } catch (e) {
    await playMp3FromUrl("https://assets.mixkit.co/active_storage/sfx/1084/1084.wav").catch(console.error);
    console.error("Error navigating to skrining page:", e.message);
    return processData(browser, data);
  }
  await page.waitForSelector("#nik", { visible: true });
  await sleep(3e3);
  if (!data) {
    throw new Error("No more data to process.");
  }
  if (!data.parsed_nik || typeof data.parsed_nik === "object" && Object.keys(data.parsed_nik).length === 0) {
    console.log(`Parsed NIK is empty for NIK: ${data.nik}, reparsing...`);
    data.parsed_nik = nikParse(data.nik).data;
  }
  console.log("Processing:", data);
  if (!`${data.tanggal}`.includes("/") || !data.tanggal || data.tanggal.length < 8) {
    await browser.close();
    throw new Error(`INVALID DATE ${JSON.stringify(data, null, 2)}`);
  }
  const parseTanggal = moment(data.tanggal, "DD/MM/YYYY", true);
  if (!parseTanggal.isValid()) {
    await browser.close();
    throw new Error(`INVALID DATE ${JSON.stringify(data, null, 2)}`);
  }
  if (parseTanggal.day() === 0) {
    await browser.close();
    throw new Error(`SUNDAY DATE NOT ALLOWED: ${data.tanggal}`);
  }
  await page.$eval("#dt_tgl_skrining", (el) => el.removeAttribute("readonly"));
  await typeAndTrigger(page, "#dt_tgl_skrining", data.tanggal);
  await page.$eval("#dt_tgl_skrining", (el) => el.setAttribute("readonly", "true"));
  await typeAndTrigger(page, 'input[name="metode_id_input"]', "Tunggal");
  await typeAndTrigger(page, 'input[name="tempat_skrining_id_input"]', "Puskesmas");
  if (data.nik.length < 16) {
    console.error("Skipping due NIK length invalid, should be 16 digits.");
    appendLog(data, "Invalid Data");
    buildHtmlLog();
    return {
      status: "error",
      reason: "invalid_nik_length",
      description: "Skipping due NIK length invalid, should be 16 digits."
    };
  }
  await typeAndTrigger(page, "#nik", getNumbersOnly(data.nik));
  await sleep(5e3);
  try {
    await page.waitForSelector(".k-widget.k-window.k-window-maximized", { timeout: 5e3 });
  } catch (_e) {
  }
  try {
    await page.waitForSelector('[aria-labelledby="dialogconfirm_wnd_title"]', { visible: true, timeout: 5e3 });
  } catch (_e) {
  }
  console.log("Is NIK error notification visible:", await isNikErrorVisible(page));
  if (await isNikErrorVisible(page)) {
    waitEnter("Please check NIK error notification. Press Enter to continue...");
    throw new Error("NIK error notification visible, please re-check. Aborting...");
  }
  console.log("Identity modal is visible:", await isIdentityModalVisible(page));
  if (await isIdentityModalVisible(page)) {
    await confirmIdentityModal(page);
  }
  const isNikNotFound = await isNIKNotFoundModalVisible(page);
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
      await typeAndTrigger(page, '#field_item_nama_peserta input[type="text"]', data.nama);
      if (!data.parsed_nik) {
        throw new Error("\u274C Failed to parse NIK data");
      }
      const parsed_nik_gender = data.parsed_nik.kelamin.toLowerCase() == "laki-laki" ? "Laki-laki" : "Perempuan";
      console.log(`Gender ${parsed_nik_gender} detected from NIK`);
      await typeAndTrigger(page, '#field_item_jenis_kelamin_id input[type="text"]', parsed_nik_gender);
      const parsedLahir = moment(data.tgl_lahir, ["DD/MM/YYYY", "YYYY-MM-DD"], true);
      if (!parsedLahir.isValid()) {
        throw new Error(`\u274C Invalid birth date format from NIK, expected DD/MM/YYYY, got: ${data.tgl_lahir}`);
      }
      await typeAndTrigger(page, '#field_item_tgl_lahir input[type="text"]', parsedLahir.format("DD/MM/YYYY"));
      if (!data.alamat || data.alamat.length === 0) {
        throw new Error("\u274C Failed to take the patient's address");
      }
      const keywordAddr = `${data.alamat} Surabaya, Jawa Timur`.trim();
      const address = await geocodeWithNominatim(keywordAddr);
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
      await typeAndTrigger(page, '#field_item_provinsi_ktp_id input[type="text"]', ucwords(provinsi));
      await typeAndTrigger(page, '#field_item_kabupaten_ktp_id input[type="text"]', ucwords(kotakab));
      await typeAndTrigger(page, '#field_item_kecamatan_ktp_id input[type="text"]', ucwords(kecamatan));
      await typeAndTrigger(page, '#field_item_kelurahan_ktp_id input[type="text"]', ucwords(kelurahan));
      await typeAndTrigger(page, '#field_item_alamat_ktp textarea[type="text"]', data.alamat);
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
  const { gender, age, birthDate, location } = await getPersonInfo(page);
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
    await typeAndTrigger(page, '#field_item_provinsi_ktp_id input[type="text"]', "Jawa Timur");
  }
  console.log(`Kabupaten/Kota: ${city}`, city.length == 0 ? "(empty)" : "");
  if (city.length == 0) {
    await typeAndTrigger(page, '#field_item_kabupaten_ktp_id input[type="text"]', "Kota Surabaya");
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
      await waitEnter(
        `Undefined Job for data: ${JSON.stringify(data)}. Please fix and press enter to continue auto fill.`
      );
    }
  }
  console.log(`Pekerjaan: ${data.pekerjaan}`);
  await typeAndTrigger(page, 'input[name="pekerjaan_id_input"]', data.pekerjaan);
  if (!data.bb || !data.tb) {
    await fixTbAndBb(page, age, gender);
  } else {
    await page.focus('#field_item_berat_badan input[type="text"]');
    await page.type('#field_item_berat_badan input[type="text"]', extractNumericWithComma(data.bb), { delay: 100 });
    await page.focus('#field_item_tinggi_badan input[type="text"]');
    await page.type('#field_item_tinggi_badan input[type="text"]', extractNumericWithComma(data.tb), { delay: 100 });
  }
  await typeAndTrigger(page, '#field_item_riwayat_kontak_tb_id input[type="text"]', "Tidak");
  await typeAndTrigger(page, '#field_item_risiko_1_id input[type="text"]', "Tidak");
  await typeAndTrigger(page, '#field_item_risiko_4_id input[type="text"]', "Tidak");
  await typeAndTrigger(page, '#field_item_risiko_5_id input[type="text"]', "Tidak");
  if (data.diabetes) {
    await typeAndTrigger(page, '#field_item_risiko_6_id input[type="text"]', "Ya");
  } else {
    await typeAndTrigger(page, '#field_item_risiko_6_id input[type="text"]', "Tidak");
  }
  await typeAndTrigger(page, '#field_item_risiko_7_id input[type="text"]', "Tidak");
  if (gender.toLowerCase().trim() == "perempuan") {
    await typeAndTrigger(page, '#field_item_risiko_9_id input[type="text"]', "Tidak");
  }
  await typeAndTrigger(page, '#field_item_risiko_10_id input[type="text"]', "Tidak");
  await typeAndTrigger(page, '#field_item_risiko_11_id input[type="text"]', "Tidak");
  await typeAndTrigger(page, '#field_item_gejala_2_3_id input[type="text"]', "Tidak");
  await typeAndTrigger(page, '#field_item_gejala_2_4_id input[type="text"]', "Tidak");
  await typeAndTrigger(page, '#field_item_gejala_2_5_id input[type="text"]', "Tidak");
  await typeAndTrigger(page, '#field_item_gejala_6_id input[type="text"]', "Tidak");
  await typeAndTrigger(page, '#field_item_cxr_pemeriksaan_id input[type="text"]', "Tidak");
  if (age < 18) {
    const gejalaBalitaSelectors = [
      '#field_item_gejala_1_1_id input[type="text"]',
      '#field_item_gejala_1_3_id input[type="text"]',
      '#form_item_gejala_1_4_id input[type="text"]',
      '#field_item_gejala_1_5_id input[type="text"]'
    ];
    for (const gejalaBalitaSelector of gejalaBalitaSelectors) {
      if (isElementExist(page, gejalaBalitaSelector)) {
        console.log(
          `Gejala balita ${gejalaBalitaSelector} is visible ${await isElementVisible(page, gejalaBalitaSelector)}`
        );
        if (await isElementVisible(page, gejalaBalitaSelector)) {
          await typeAndTrigger(page, gejalaBalitaSelector, "Tidak");
          await sleep(200);
        }
      }
    }
  }
  await page.keyboard.press("Tab");
  if (!data.batuk) {
    await typeAndTrigger(page, '#field_item_gejala_2_1_id input[type="text"]', "Tidak");
  } else {
    let keteranganBatuk = data.batuk.replace(/ya,/, "batuk");
    if (/\d/m.test(keteranganBatuk)) {
      await typeAndTrigger(page, "#field_item_keterangan textarea", keteranganBatuk);
      await waitEnter("Please fix data batuk/demam. Press Enter to continue...");
    }
  }
  await sleep(2e3);
  while (await isIdentityModalVisible(page)) {
    await confirmIdentityModal(page);
    await sleep(1e3);
    if (await isIdentityModalVisible(page)) {
      await waitEnter("Please check identity modal. Press Enter to continue...");
    }
  }
  while (await isInvalidAlertVisible(page)) {
    await typeAndTrigger(page, 'input[name="metode_id_input"]', "Tunggal");
    await typeAndTrigger(page, 'input[name="tempat_skrining_id_input"]', "Puskesmas");
    await typeAndTrigger(page, 'input[name="pekerjaan_id_input"]', data.pekerjaan);
    if (await isInvalidAlertVisible(page)) {
      console.warn("\u26A0\uFE0F Invalid alert detected for the following data:");
      console.dir(data, { depth: null });
      await waitEnter("Please review the alert and press Enter to continue...");
    }
  }
  let hasSubmitted;
  const identityModalVisible = await isIdentityModalVisible(page);
  const invalidAlertVisible = await isInvalidAlertVisible(page);
  const nikErrorVisible = await isNikErrorVisible(page);
  const nikNotFoundModalVisible = await isNIKNotFoundModalVisible(page);
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
    await sleep(1e3);
    try {
      await page.waitForSelector("#yesButton", { visible: true });
      await page.click("#yesButton");
    } catch (_) {
      waitEnter(
        "Failed to click #yesButton for confirmation modal. Please click the button manually, then press Enter to continue..."
      );
    }
    await sleep(1e3);
    while (true) {
      const isSuccessVisible = await isSuccessNotificationVisible(page);
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
    await waitEnter("Press Enter to continue...");
  }
  return {
    status: "success",
    data
  };
}
async function runEntrySkrining(dataCallback = (data) => data) {
  const datas = await fetchXlsxData3(process.env.index_start, process.env.index_end);
  const puppeteer = await getPuppeteer();
  let page = puppeteer.page;
  const browser = puppeteer.browser;
  await skrinLogin(page);
  while (datas.length > 0) {
    let data = await dataCallback(datas.shift());
    const result = await processData(browser, data);
    if (result.status == "error") {
      console.error(Object.assign(result, { data }));
      break;
    } else {
      appendLog(data);
      await buildHtmlLog();
    }
  }
  console.log("All data processed.");
  buildHtmlLog();
  await browser.close();
}

export { processData, runEntrySkrining };
//# sourceMappingURL=skrin.js.map
//# sourceMappingURL=skrin.js.map