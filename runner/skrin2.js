import 'dotenv/config';
import moment from 'moment';
import * as nikUtils from 'nik-parser-jurusid/index';
import { loadCsvData, parseBabyName } from '../../data/index.js';
import { getLogById, addLog } from '../database/SQLiteLogDatabase.js';
import { getPuppeteer, waitForDomStable, typeAndTriggerIframe, validateAndRetryIframeInput, isIframeElementVisible, clickIframeElement, getFormValuesFromFrame, isElementVisible } from '../puppeteer_utils.js';
import { skrinLogin, enterSkriningPage } from '../skrin_puppeteer.js';
import { logLine, getNumbersOnly, sleep, waitEnter, extractNumericWithComma, logInline } from '../utils.js';
import { ucwords } from '../utils/string.js';
import { fixData } from '../xlsx-helper.js';
import minimist from 'minimist';
import ansiColors from 'ansi-colors';

console.clear();
const cliArgs = minimist(process.argv.slice(2), {
  boolean: ["help", "shuffle"],
  alias: {
    h: "help",
    sh: "shuffle"
  }
});
function showHelp() {
  console.log(`
    Usage: node skrin2.js [options]

    Options:
      -h, --help        Show help
      -sh, --shuffle    Shuffle the data
  `);
}
async function processData(page, data) {
  const fixedData = await fixData(data);
  const NIK = getNumbersOnly(fixedData.nik);
  const cachedData = getLogById(NIK);
  if (cachedData && cachedData.data && cachedData.data.status === "success") {
    logLine(`Data for NIK: ${NIK} already processed. Skipping...`);
    return;
  }
  logLine("Processing", fixedData);
  const iframeSelector = ".k-window-content iframe.k-content-frame";
  await enterSkriningPage(page, false);
  await page.waitForSelector(iframeSelector, { visible: true, timeout: 3e4 });
  await waitForDomStable(page, 3e3, 3e4);
  await page.waitForFunction(
    () => {
      const iframe2 = document.querySelector(".k-window-content iframe.k-content-frame");
      if (!iframe2 || !iframe2.contentDocument) return false;
      const datePickerElement = iframe2.contentDocument.getElementById("dt_tgl_skrining");
      return datePickerElement !== null;
    },
    { timeout: 3e4 }
  );
  logLine("Iframe loaded and datepicker element is ready");
  const iframeElement = await page.$(iframeSelector);
  const iframe = await iframeElement.contentFrame();
  const iframeType = async (selector, value) => {
    const isVisible = await iframe.$eval(selector, (el) => {
      const style = window.getComputedStyle(el);
      return style && style.display !== "none" && style.visibility !== "hidden" && el.offsetParent !== null;
    });
    if (!isVisible) {
      logLine(`Element ${selector} is not visible, skipping typing.`);
      return;
    }
    await iframe.$eval(selector, (el) => el.scrollIntoView({ behavior: "auto", block: "center" }));
    await iframe.focus(selector);
    await page.evaluate(
      (iframeSelector2, selector2) => {
        const iframe2 = document.querySelector(iframeSelector2);
        const element = iframe2.contentDocument.querySelector(selector2);
        element.value = "";
        element.dispatchEvent(new iframe2.contentWindow.Event("input", { bubbles: true }));
      },
      iframeSelector,
      selector
    );
    await iframe.type(selector, value, { delay: 100 });
    await iframe.$eval(selector, (el) => {
      const event = new Event("change", { bubbles: true });
      el.dispatchEvent(event);
    });
    await sleep(1e3);
  };
  const tanggalEntry = fixedData["TANGGAL ENTRY"] || fixedData.tanggal;
  if (tanggalEntry) {
    await iframe.focus("#dt_tgl_skrining");
    await iframe.$eval("#dt_tgl_skrining", (e) => e.removeAttribute("readonly"));
    await typeAndTriggerIframe(page, iframeSelector, "#dt_tgl_skrining", tanggalEntry);
    await iframe.$eval("#dt_tgl_skrining", (el) => {
      const events = ["input", "change", "blur", "keyup", "keydown"];
      events.forEach((eventType) => {
        const event = new Event(eventType, { bubbles: true, cancelable: true });
        el.dispatchEvent(event);
      });
      if (typeof window.$ !== "undefined" && window.$(el).length) {
        window.$(el).trigger("change").trigger("blur");
      }
    });
    await sleep(500);
    await iframe.$eval("#dt_tgl_skrining", (e) => e.setAttribute("readonly", "true"));
    const dateValidated = await validateAndRetryIframeInput(page, iframeSelector, "#dt_tgl_skrining", tanggalEntry, {
      maxRetries: 2,
      retryDelay: 1e3
    });
    if (dateValidated) {
      logLine(`Date ${tanggalEntry} successfully applied to #dt_tgl_skrining`);
    } else {
      logLine(`Warning: Date ${tanggalEntry} may not have been properly applied to #dt_tgl_skrining`);
    }
    await sleep(1500);
    await waitForDomStable(page, 3e3, 3e4);
  }
  await iframeType('#field_item_metode_id input[type="text"]', "Tunggal");
  await iframeType('input[name="tempat_skrining_id_input"]', "Puskesmas");
  await typeAndTriggerIframe(page, iframeSelector, "#nik", NIK);
  await sleep(4e3);
  await waitForDomStable(page, 3e3, 3e4);
  const isInvalidAlertVisible = async () => await isIframeElementVisible(page, iframeSelector, ".k-widget.k-tooltip.k-tooltip-validation.k-invalid-msg");
  const isIdentityModalVisible = async () => await isIframeElementVisible(page, iframeSelector, ".k-widget.k-window.k-window-maximized");
  const isNikErrorVisible = async () => await isIframeElementVisible(page, iframeSelector, ".k-notification-error");
  const isNIKNotFoundModalVisible = async () => await isIframeElementVisible(page, iframeSelector, '[aria-labelledby="dialogconfirm_wnd_title"]');
  let isManualInput = false;
  if (await isNIKNotFoundModalVisible()) {
    logLine(`Confirmation modal is visible - Data tidak ditemukan`);
    const hasYesButton = await isIframeElementVisible(page, iframeSelector, "#yesButton");
    const hasNoButton = await isIframeElementVisible(page, iframeSelector, "#noButton");
    if (hasYesButton && hasNoButton) {
      logLine(`Both Yes and No buttons are available`);
      const clickSuccess = await clickIframeElement(page, iframeSelector, "#yesButton");
      if (clickSuccess) {
        logLine(`Successfully clicked Yes button - continuing with manual input`);
        isManualInput = true;
      } else {
        logLine(`Failed to click Yes button`);
      }
    }
  } else if (await isIdentityModalVisible()) {
    logLine(`Identity modal is visible - NIK is already registered. Confirming identity...`);
    const innerFrameElement = await iframe.$("#dialog iframe.k-content-frame");
    const innerFrameContent = await innerFrameElement.contentFrame();
    await innerFrameContent.waitForSelector("body", { visible: true, timeout: 1e4 });
    const pilihBtn = await innerFrameContent.$("#pilih");
    if (pilihBtn) {
      const isVisible = await innerFrameContent.$eval("#pilih", (el) => {
        const style = window.getComputedStyle(el);
        return style && style.display !== "none" && style.visibility !== "hidden" && el.offsetParent !== null;
      }).catch(() => false);
      if (isVisible) {
        await innerFrameContent.$eval("#pilih", (el) => el.scrollIntoView({ behavior: "smooth", block: "end" }));
        await pilihBtn.click({ delay: 100 });
        logLine("Clicked pilih button to confirm identity.");
      } else {
        throw new Error("Pilih button is not visible in identity modal.");
      }
    } else {
      throw new Error("Pilih button not found in identity modal.");
    }
    const pilihStillVisible = await innerFrameContent.$eval("#pilih", (el) => !!el && el.offsetParent !== null).catch(() => false);
    if (pilihStillVisible) {
      await waitEnter(
        "Pilih button still visible after clicking. Please resolve the identity confirmation manually, then press Enter to continue..."
      );
    }
  }
  if (!isManualInput) {
    logLine(`NIK: ${NIK} is already registered, skipping manual input.`);
    const isGenderEmpty = await iframe.$eval(
      '#field_item_jenis_kelamin_id input[type="text"]',
      (el) => !el.value || el.value.trim() === ""
    );
    const isKabupatenEmpty = await iframe.$eval(
      '#field_item_kabupaten_ktp_id input[type="text"]',
      (el) => !el.value || el.value.trim() === ""
    );
    const isProvinsiEmpty = await iframe.$eval(
      '#field_item_provinsi_ktp_id input[type="text"]',
      (el) => !el.value || el.value.trim() === ""
    );
    const isKecamatanEmpty = await iframe.$eval(
      '#field_item_kecamatan_ktp_id input[type="text"]',
      (el) => !el.value || el.value.trim() === ""
    );
    const isKelurahanEmpty = await iframe.$eval(
      '#field_item_kelurahan_ktp_id input[type="text"]',
      (el) => !el.value || el.value.trim() === ""
    );
    console.log(
      `isGenderEmpty: ${isGenderEmpty}, isKabupatenEmpty: ${isKabupatenEmpty}, isProvinsiEmpty: ${isProvinsiEmpty}, isKecamatanEmpty: ${isKecamatanEmpty}, isKelurahanEmpty: ${isKelurahanEmpty}`
    );
    if (isGenderEmpty || isKabupatenEmpty || isProvinsiEmpty || isKecamatanEmpty || isKelurahanEmpty) {
      isManualInput = true;
    }
  }
  if (isManualInput) {
    logLine(`Proceeding with manual input for NIK: ${NIK}`);
    await iframeType('#field_item_nama_peserta input[type="text"]', fixedData.nama);
    if (fixedData.gender !== "Tidak Diketahui") {
      await typeAndTriggerIframe(
        page,
        iframeSelector,
        '#field_item_jenis_kelamin_id input[type="text"]',
        fixedData.gender
      );
    } else {
      throw new Error(`Gender is not known for NIK: ${NIK}`);
    }
    let tglLahir = fixedData["TGL LAHIR"] || fixedData.tgl_lahir;
    if (!moment(tglLahir, "DD/MM/YYYY", true).isValid()) {
      throw new Error(`Invalid date format for TGL LAHIR: ${tglLahir} (NIK: ${NIK})`);
    } else {
      await typeAndTriggerIframe(page, iframeSelector, '#field_item_tgl_lahir input[type="text"]', tglLahir);
    }
    logLine("Resolved tglLahir: " + tglLahir);
    if (fixedData.parsed_nik && fixedData.parsed_nik.status === "success") {
      const parsed_nik = fixedData.parsed_nik.data;
      let { kotakab = "", namaKec = "", provinsi = "", kelurahan = [] } = parsed_nik;
      if (provinsi.length > 0) {
        await typeAndTriggerIframe(
          page,
          iframeSelector,
          '#field_item_provinsi_ktp_id input[type="text"]',
          ucwords(provinsi)
        );
      }
      if (kotakab.length > 0) {
        await typeAndTriggerIframe(
          page,
          iframeSelector,
          '#field_item_kabupaten_ktp_id input[type="text"]',
          ucwords(kotakab)
        );
      }
      if (namaKec.length > 0) {
        await typeAndTriggerIframe(
          page,
          iframeSelector,
          '#field_item_kecamatan_ktp_id input[type="text"]',
          ucwords(namaKec)
        );
      }
      if (kelurahan.length > 0) {
        const selectedKelurahan = kelurahan[0];
        if (selectedKelurahan && selectedKelurahan.name) {
          logLine(`Using parsed NIK data for address: ${selectedKelurahan.name}, ${namaKec}, ${kotakab}, ${provinsi}`);
          await typeAndTriggerIframe(
            page,
            iframeSelector,
            '#field_item_kelurahan_ktp_id input[type="text"]',
            ucwords(selectedKelurahan.name)
          );
        }
      }
    }
  }
  if (fixedData.alamat && String(fixedData.alamat).trim() !== "") {
    await typeAndTriggerIframe(
      page,
      iframeSelector,
      '#field_item_alamat_ktp textarea[type="text"]',
      String(fixedData.alamat)
    );
  }
  logLine(`Inputting pekerjaan: ${fixedData.pekerjaan} for NIK: ${NIK}`);
  await iframeType('input[name="pekerjaan_id_input"]', fixedData.pekerjaan);
  const bb = fixedData.bb || fixedData.BB || null;
  const tb = fixedData.tb || fixedData.TB || null;
  logLine(`Inputting berat badan (${bb}) dan tinggi badan (${tb}) untuk NIK: ${NIK}`);
  await iframeType('#field_item_berat_badan input[type="text"]', extractNumericWithComma(bb));
  await iframeType('#field_item_tinggi_badan input[type="text"]', extractNumericWithComma(tb));
  await iframeType('#field_item_risiko_6_id input[type="text"]', fixedData.diabetes ? "Ya" : "Tidak");
  await page.keyboard.press("Tab");
  if (fixedData.gender.toLowerCase().trim() === "perempuan") {
    await iframeType('#field_item_risiko_9_id input[type="text"]', "Tidak");
    await page.keyboard.press("Tab");
  }
  if (!fixedData.batuk) {
    logLine(`Inputting batuk: Tidak ${fixedData.NAMA} (${NIK})`);
    await iframeType('#field_item_gejala_2_1_id input[type="text"]', "Tidak");
    await page.keyboard.press("Tab");
  } else {
    let keteranganBatuk = fixedData.batuk.replace(/ya,/, "batuk");
    logLine(`Inputting batuk: ${keteranganBatuk} ${fixedData.NAMA} (${NIK})`);
    if (/\d/m.test(keteranganBatuk)) {
      await iframeType("#field_item_keterangan textarea", keteranganBatuk);
      logLine(`Keterangan batuk contains a number for NIK: ${NIK}, waiting for user to fix data...`);
      await waitEnter(`Please fix data batuk/demam for ${fixedData.NAMA} (${NIK}). Press Enter to continue...`);
    }
  }
  const tidakFields = [
    '#field_item_cxr_pemeriksaan_id input[type="text"]',
    '#field_item_gejala_2_3_id input[type="text"]',
    '#field_item_gejala_2_4_id input[type="text"]',
    '#field_item_gejala_2_5_id input[type="text"]',
    '#field_item_gejala_6_id input[type="text"]',
    '#field_item_risiko_1_id input[type="text"]',
    '#field_item_risiko_10_id input[type="text"]',
    '#field_item_risiko_11_id input[type="text"]',
    '#field_item_risiko_4_id input[type="text"]',
    '#field_item_risiko_5_id input[type="text"]',
    '#field_item_risiko_7_id input[type="text"]',
    '#field_item_riwayat_kontak_tb_id input[type="text"]'
  ];
  if (fixedData.age < 18) {
    tidakFields.push(
      '#field_item_gejala_1_1_id input[type="text"]',
      '#field_item_gejala_1_3_id input[type="text"]',
      '#form_item_gejala_1_4_id input[type="text"]',
      '#field_item_gejala_1_5_id input[type="text"]'
    );
  }
  for (const selector of tidakFields) {
    await iframeType(selector, "Tidak");
    await page.keyboard.press("Tab");
  }
  await page.keyboard.press("Tab");
  await sleep(3e3);
  const isAllowedToSubmit = async () => {
    const identityModalVisible = await isIdentityModalVisible();
    const invalidAlertVisible = await isInvalidAlertVisible();
    const nikErrorVisible = await isNikErrorVisible();
    const nikNotFoundModalVisible = await isNIKNotFoundModalVisible();
    logLine("identityModalVisible:", identityModalVisible);
    logLine("invalidAlertVisible:", invalidAlertVisible);
    logLine("nikErrorVisible:", nikErrorVisible);
    logLine("nikNotFoundModalVisible:", nikNotFoundModalVisible);
    return !identityModalVisible && !invalidAlertVisible && !nikErrorVisible && !nikNotFoundModalVisible;
  };
  await sleep(2e3);
  if (!await isAllowedToSubmit()) {
    await re_evaluate(page);
  }
  while (!await isAllowedToSubmit()) {
    logLine(`Submission not allowed for NIK: ${NIK}. Please check the form for errors.`);
    await waitEnter(`Please fix data for ${fixedData.NAMA} (${NIK}). Press Enter to continue...`);
  }
  if (await isAllowedToSubmit()) {
    logLine(`Submitting data for NIK: ${NIK}`);
    await iframe.$eval("#save", (el) => el.scrollIntoView());
    await clickIframeElement(page, iframeSelector, "#save");
    await sleep(2e3);
    let counter = 0;
    while (!await isIframeElementVisible(page, iframeSelector, "#yesButton")) {
      logInline(`Yes button is not visible for NIK: ${NIK} after ${counter}s. Please check the form for errors.`);
      await sleep(1e3);
      counter++;
    }
    counter = 0;
    logLine(`Yes button is now visible for NIK: ${NIK}. Waiting for submission...`);
    while (!isAllowedToSubmit()) {
      logInline(`Submission not allowed for NIK: ${NIK} after ${counter}s. Please check the form for errors.`);
      await sleep(1e3);
      counter++;
    }
    counter = 0;
    logLine(`Submission allowed for NIK: ${NIK}. Clicking Yes to confirm...`);
    logLine(`Getting form values for NIK: ${NIK} before submission...`);
    const formValues = (await getFormValuesFromFrame(page, iframeSelector, "#main-container")).map((item) => {
      var _a;
      if (!item.name || item.name.trim().length === 0) {
        return null;
      }
      if (item.isVisible.toLowerCase() === "false") {
        return null;
      }
      let valueLabel = item.value || "";
      if (valueLabel.trim().length === 0) {
        valueLabel = "<empty>";
      }
      let keyLabel = "";
      if (item.name && item.name.trim().length > 0) {
        keyLabel = `[name="${item.name}"]`;
      } else if (item.id && item.id.trim().length > 0) {
        keyLabel = `#${item.id}`;
      } else {
        keyLabel = "<empty-key>";
      }
      const isDisabled = ((_a = item.disabled) == null ? void 0 : _a.toLowerCase()) === "true";
      return {
        selector: keyLabel,
        value: valueLabel,
        disabled: isDisabled,
        label: item.label
      };
    }).filter((item) => item !== null);
    fixedData.formValues = formValues;
    await clickIframeElement(page, iframeSelector, "#yesButton");
  }
  await sleep(2e3);
  if (!await isElementVisible(page, iframeSelector)) {
    logLine(`Data for NIK: ${NIK} submitted successfully.`);
    addLog({
      id: NIK,
      data: { ...fixedData, status: "success" },
      message: `Data for NIK: ${NIK} submitted successfully.`
    });
  } else {
    logLine(`Data for NIK: ${NIK} submission failed. Please check the form for errors.`);
  }
}
async function re_evaluate(page) {
  const iframeSelector = ".k-window-content iframe.k-content-frame";
  const iframeElement = await page.$(iframeSelector);
  const iframe = await iframeElement.contentFrame();
  const iframeType = async (selector, value) => {
    const isVisibleAndEnabled = await iframe.$eval(selector, (el) => {
      const style = window.getComputedStyle(el);
      const notHidden = style && style.display !== "none" && style.visibility !== "hidden" && el.offsetParent !== null;
      const notDisabled = !el.disabled && !el.readOnly;
      return notHidden && notDisabled;
    }).catch(() => false);
    if (!isVisibleAndEnabled) {
      logLine(`Element ${selector} is not visible or enabled, skipping typing.`);
      return;
    }
    await iframe.$eval(selector, (el) => el.scrollIntoView({ behavior: "auto", block: "center" }));
    await iframe.click(selector).catch(() => {
    });
    await iframe.focus(selector).catch(() => {
    });
    try {
      await iframe.click(selector, { clickCount: 3 });
      await iframe.type(selector, String.fromCharCode(1), { delay: 10 });
      await iframe.keyboard.down("Control");
      await iframe.keyboard.press("A");
      await iframe.keyboard.up("Control");
      await iframe.keyboard.press("Backspace");
    } catch {
      await page.evaluate(
        (iframeSelector2, selector2) => {
          const iframe2 = document.querySelector(iframeSelector2);
          const element = iframe2.contentDocument.querySelector(selector2);
          if (element) {
            element.value = "";
            element.dispatchEvent(new iframe2.contentWindow.Event("input", { bubbles: true }));
          }
        },
        iframeSelector,
        selector
      );
    }
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await iframe.type(selector, value, { delay: 100 });
        await iframe.waitForFunction(
          (sel, val) => {
            const el = document.querySelector(sel);
            return el && el.value && el.value.trim() === val.trim();
          },
          {},
          selector,
          value
        );
        await iframe.$eval(selector, (el) => {
          el.dispatchEvent(new Event("input", { bubbles: true }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
        });
        await sleep(500);
        return;
      } catch (err) {
        lastError = err;
        logLine(`Typing attempt ${attempt + 1} failed for ${selector}: ${err}`);
        await sleep(300);
      }
    }
    logLine(`Failed to type value into ${selector} after 3 attempts. Last error: ${lastError}`);
  };
  const isInputEmpty = async (selector) => {
    try {
      const value = await iframe.$eval(selector, (el) => el.value);
      return !value || value.trim() === "";
    } catch (err) {
      logLine(`Error checking input empty state for ${selector} with $eval: ${err}`);
      try {
        const value = await page.evaluate(
          (iframeSelector2, selector2) => {
            const iframe2 = document.querySelector(iframeSelector2);
            if (!iframe2) return "";
            const el = iframe2.contentDocument.querySelector(selector2);
            return el ? el.value : "";
          },
          iframeSelector,
          selector
        );
        return !value || value.trim() === "";
      } catch (err2) {
        logLine(`Fallback JS evaluate failed for ${selector}: ${err2}`);
        return true;
      }
    }
  };
  if (await isInputEmpty('#field_item_nama_peserta input[type="text"]'))
    await iframeType('#field_item_metode_id input[type="text"]', "Tunggal");
  if (await isInputEmpty('input[name="tempat_skrining_id_input"]'))
    await iframeType('input[name="tempat_skrining_id_input"]', "Puskesmas");
}
const _main = async () => {
  const { page, browser } = await getPuppeteer();
  await skrinLogin(page);
  const dataKunto = await loadCsvData();
  for (let i = 0; i < dataKunto.length; i++) {
    if (/bayi/i.test(dataKunto[i].nama)) {
      const namaBayi = parseBabyName(dataKunto[i].nama);
      if (namaBayi) {
        logLine(`Parsed baby name: ${dataKunto[i].nama} -> ${ansiColors.green(namaBayi)}`);
        dataKunto[i].nama = namaBayi;
      } else {
        logLine(`Failed to parse baby name: ${dataKunto[i].nama}`);
        dataKunto[i].skip = true;
      }
    }
  }
  if (cliArgs.shuffle) {
    for (let i = dataKunto.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dataKunto[i], dataKunto[j]] = [dataKunto[j], dataKunto[i]];
    }
    logLine("Data shuffled");
  }
  const unprocessedData = dataKunto.filter((item) => {
    const nik = getNumbersOnly(item.nik);
    return !getLogById(nik) || Object.hasOwn(getLogById(nik).data, "status") === false;
  });
  while (unprocessedData.length > 0) {
    const currentData = unprocessedData.shift();
    if (currentData.skip) {
      continue;
    }
    if (!nikUtils.isValidNIK(currentData.nik)) {
      logLine(`Skipping invalid NIK: ${currentData.nik}`);
      addLog({
        id: getNumbersOnly(currentData.nik),
        data: { ...currentData, status: "invalid" },
        message: "Invalid NIK format"
      });
      continue;
    }
    if ((await browser.pages()).length > 3) {
      const pages = await browser.pages();
      await pages[0].close();
    }
    if (currentData) await processData(await browser.newPage(), currentData);
  }
};
if (cliArgs.help) {
  showHelp();
  process.exit(0);
} else {
  _main().then(() => {
    logLine("All done!");
    process.exit(0);
  }).catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
}
//# sourceMappingURL=skrin2.js.map
//# sourceMappingURL=skrin2.js.map