import ansiColors from 'ansi-colors';
import 'dotenv/config';
import minimist from 'minimist';
import moment from 'moment';
import * as nikUtils from 'nik-parser-jurusid/index';
import { loadCsvData, parseBabyName } from '../../data/index.js';
import { addLog, getLogById } from '../database/SQLiteLogDatabase.js';
import {
  clickIframeElement,
  findIframeElementByText,
  getFormValuesFromFrame,
  getPuppeteer,
  isElementVisible,
  isIframeElementVisible,
  isIframeTextVisible,
  typeAndTriggerIframe,
  validateAndRetryIframeInput,
  waitForDomStable
} from '../puppeteer_utils.js';
import { enterSkriningPage, skrinLogin } from '../skrin_puppeteer.js';
import { extractNumericWithComma, getNumbersOnly, logInline, logLine, sleep, waitEnter } from '../utils.js';
import { ucwords } from '../utils/string.js';
import { fixData } from '../xlsx-helper.js';

console.clear();

const cliArgs = minimist(process.argv.slice(2), {
  boolean: ['help', 'shuffle'],
  alias: {
    h: 'help',
    sh: 'shuffle',
    s: 'single'
  }
});

function showHelp() {
  console.log(`
    Usage: node skrin2.js [options]

    Options:
      -h, --help        Show help
      -sh, --shuffle    Shuffle the data
      -s, --single      Process a single data entry
  `);
}

/**
 * Processes a single data entry in the skrining workflow.
 *
 * @async
 * @param {import('puppeteer').Page} page - Puppeteer page instance to operate on.
 * @param {import('../../globals.js').ExcelRowData} data - A single data row from getDataRange (already fixed by fixData).
 * @returns {Promise<void>} Resolves when processing is complete.
 */
async function processData(page, data) {
  const fixedData = await fixData(data);
  const NIK = getNumbersOnly(fixedData.nik);
  const cachedData = getLogById(NIK);
  if (cachedData && cachedData.data && cachedData.data.status === 'success') {
    logLine(`Data for NIK: ${NIK} already processed. Skipping...`);
    return;
  }

  logLine('Processing', fixedData);

  const iframeSelector = '.k-window-content iframe.k-content-frame';

  await enterSkriningPage(page, false);

  // Wait for the dialog window iframe to appear
  await page.waitForSelector(iframeSelector, { visible: true, timeout: 30000 });
  await waitForDomStable(page, 3000, 30000);

  // Wait for the iframe to load and the datepicker element to be ready
  await page.waitForFunction(
    () => {
      const iframe = document.querySelector('.k-window-content iframe.k-content-frame');
      if (!iframe || !iframe.contentDocument) return false;

      const datePickerElement = iframe.contentDocument.getElementById('dt_tgl_skrining');
      return datePickerElement !== null;
    },
    { timeout: 30000 }
  );

  logLine('Iframe loaded and datepicker element is ready');

  // Get the iframe element and its content frame
  const iframeElement = await page.$(iframeSelector);
  const iframe = await iframeElement.contentFrame();
  const iframeType = async (selector, value) => {
    // Skip if element is hidden
    const isVisible = await iframe.$eval(selector, (el) => {
      const style = window.getComputedStyle(el);
      return style && style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
    });
    if (!isVisible) {
      logLine(`Element ${selector} is not visible, skipping typing.`);
      return;
    }
    // Scroll to the element before typing
    await iframe.$eval(selector, (el) => el.scrollIntoView({ behavior: 'auto', block: 'center' }));
    // Focus the element before typing
    await iframe.focus(selector);
    // Reset existing value before typing
    await page.evaluate(
      (iframeSelector, selector) => {
        const iframe = document.querySelector(iframeSelector);
        const element = iframe.contentDocument.querySelector(selector);
        element.value = '';
        element.dispatchEvent(new iframe.contentWindow.Event('input', { bubbles: true }));
      },
      iframeSelector,
      selector
    );
    // Type the value into the input field
    await iframe.type(selector, value, { delay: 100 });
    // Trigger input and change events
    await iframe.$eval(selector, (el) => {
      const event = new Event('change', { bubbles: true });
      el.dispatchEvent(event);
    });
    // Wait for the input to stabilize
    await sleep(1000);
  };

  const tanggalEntry = fixedData['TANGGAL ENTRY'] || fixedData.tanggal;

  // Set the date value in the iframe's datepicker element

  if (tanggalEntry) {
    await iframe.focus('#dt_tgl_skrining');
    await iframe.$eval('#dt_tgl_skrining', (e) => e.removeAttribute('readonly'));
    await typeAndTriggerIframe(page, iframeSelector, '#dt_tgl_skrining', tanggalEntry);

    // More robust event triggering for datepicker
    await iframe.$eval('#dt_tgl_skrining', (el) => {
      // Trigger multiple events to ensure compatibility with different datepicker implementations
      const events = ['input', 'change', 'blur', 'keyup', 'keydown'];
      events.forEach((eventType) => {
        const event = new Event(eventType, { bubbles: true, cancelable: true });
        el.dispatchEvent(event);
      });

      // Also trigger jQuery events if jQuery is available
      if (typeof window.$ !== 'undefined' && window.$(el).length) {
        window.$(el).trigger('change').trigger('blur');
      }
    });

    await sleep(500); // Allow events to propagate
    await iframe.$eval('#dt_tgl_skrining', (e) => e.setAttribute('readonly', 'true'));

    // Validate that the date was properly set
    const dateValidated = await validateAndRetryIframeInput(page, iframeSelector, '#dt_tgl_skrining', tanggalEntry, {
      maxRetries: 2,
      retryDelay: 1000
    });

    if (dateValidated) {
      logLine(`Date ${tanggalEntry} successfully applied to #dt_tgl_skrining`);
    } else {
      logLine(`Warning: Date ${tanggalEntry} may not have been properly applied to #dt_tgl_skrining`);
    }

    await sleep(1500); // Extended wait for the datepicker to process the input
    await waitForDomStable(page, 3000, 30000);
  }

  // Insert default skrining inputs

  await iframeType('#field_item_metode_id input[type="text"]', 'Tunggal');
  await iframeType('input[name="tempat_skrining_id_input"]', 'Puskesmas');
  await typeAndTriggerIframe(page, iframeSelector, 'input[name="nik"]', NIK);

  await sleep(10000); // Wait for the NIK input to process
  await waitForDomStable(page, 3000, 30000);

  // Narrow the search to Kendo modal container:
  const parentSelector = 'div.k-window[data-role="draggable"]';

  const modal = await findIframeElementByText(page, iframeSelector, parentSelector, 'Data tidak ditemukan');

  if (modal) {
    console.log('❌ Visible modal with "Data tidak ditemukan" found in iframe');
    const yesButton = await modal.$('#yesButton');
    if (yesButton) await yesButton.click();
    await sleep(500);
  }

  const modalDataNotFoundVisible = await isIframeTextVisible(
    page,
    iframeSelector,
    parentSelector,
    'Data tidak ditemukan'
  );

  if (modalDataNotFoundVisible) {
    console.log('❌ Visible modal with "Data tidak ditemukan" found in iframe');
    await waitEnter('Please handle the "Data tidak ditemukan" modal manually, then press Enter to continue...');
  }

  const isInvalidAlertVisible = async () =>
    await isIframeElementVisible(page, iframeSelector, '.k-widget.k-tooltip.k-tooltip-validation.k-invalid-msg');
  const isIdentityModalVisible = async () =>
    await isIframeElementVisible(page, iframeSelector, '.k-widget.k-window.k-window-maximized');
  const isNikErrorVisible = async () => await isIframeElementVisible(page, iframeSelector, '.k-notification-error');
  const isNIKNotFoundModalVisible = async () =>
    await isIframeElementVisible(page, iframeSelector, '[aria-labelledby="dialogconfirm_wnd_title"]');

  // Check NIK not found modal visibility
  let isManualInput = false;
  if (await isNIKNotFoundModalVisible()) {
    // NIK not found, handle confirmation modal then proceed with manual input
    logLine(`Confirmation modal is visible - Data tidak ditemukan`);

    // You can check for specific buttons too
    const hasYesButton = await isIframeElementVisible(page, iframeSelector, '#yesButton');
    const hasNoButton = await isIframeElementVisible(page, iframeSelector, '#noButton');

    if (hasYesButton && hasNoButton) {
      logLine(`Both Yes and No buttons are available`);
      // Here you can click on the appropriate button

      // Click the Yes button to continue with manual input
      const clickSuccess = await clickIframeElement(page, iframeSelector, '#yesButton');

      if (clickSuccess) {
        logLine(`Successfully clicked Yes button - continuing with manual input`);
        isManualInput = true;
      } else {
        logLine(`Failed to click Yes button`);
      }
    }
  } else if (await isIdentityModalVisible()) {
    // NIK is already registered, handle identity confirmation modal
    logLine(`Identity modal is visible - NIK is already registered. Confirming identity...`);

    const innerFrameElement = await iframe.$('#dialog iframe.k-content-frame');
    const innerFrameContent = await innerFrameElement.contentFrame();
    await innerFrameContent.waitForSelector('body', { visible: true, timeout: 10000 });
    const pilihBtn = await innerFrameContent.$('#pilih');
    if (pilihBtn) {
      const isVisible = await innerFrameContent
        .$eval('#pilih', (el) => {
          const style = window.getComputedStyle(el);
          return style && style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
        })
        .catch(() => false);
      if (isVisible) {
        await innerFrameContent.$eval('#pilih', (el) => el.scrollIntoView({ behavior: 'smooth', block: 'end' }));
        await pilihBtn.click({ delay: 100 });
        logLine('Clicked pilih button to confirm identity.');
      } else {
        throw new Error('Pilih button is not visible in identity modal.');
      }
    } else {
      throw new Error('Pilih button not found in identity modal.');
    }
    // Refactored: Check if #pilih is still visible after clicking
    const pilihStillVisible = await innerFrameContent
      .$eval('#pilih', (el) => !!el && el.offsetParent !== null)
      .catch(() => false);
    if (pilihStillVisible) {
      await waitEnter(
        'Pilih button still visible after clicking. Please resolve the identity confirmation manually, then press Enter to continue...'
      );
    }
  }

  // Check if manual is false and province, kabupaten, kecamatan, and kelurahan are already filled
  if (!isManualInput) {
    logLine(`NIK: ${NIK} is already registered, skipping manual input.`);
    // Check if gender field is empty to determine if form is filled
    const isGenderEmpty = await iframe.$eval(
      '#field_item_jenis_kelamin_id input[type="text"]',
      (el) => !el.value || el.value.trim() === ''
    );
    const isKabupatenEmpty = await iframe.$eval(
      '#field_item_kabupaten_ktp_id input[type="text"]',
      (el) => !el.value || el.value.trim() === ''
    );
    const isProvinsiEmpty = await iframe.$eval(
      '#field_item_provinsi_ktp_id input[type="text"]',
      (el) => !el.value || el.value.trim() === ''
    );
    const isKecamatanEmpty = await iframe.$eval(
      '#field_item_kecamatan_ktp_id input[type="text"]',
      (el) => !el.value || el.value.trim() === ''
    );
    const isKelurahanEmpty = await iframe.$eval(
      '#field_item_kelurahan_ktp_id input[type="text"]',
      (el) => !el.value || el.value.trim() === ''
    );
    console.log(
      `isGenderEmpty: ${isGenderEmpty}, isKabupatenEmpty: ${isKabupatenEmpty}, isProvinsiEmpty: ${isProvinsiEmpty}, isKecamatanEmpty: ${isKecamatanEmpty}, isKelurahanEmpty: ${isKelurahanEmpty}`
    );
    if (isGenderEmpty || isKabupatenEmpty || isProvinsiEmpty || isKecamatanEmpty || isKelurahanEmpty) {
      // If any field is empty, set isManualInput to true
      isManualInput = true;
    }
  }

  if (isManualInput) {
    // Proceed with manual input

    logLine(`Proceeding with manual input for NIK: ${NIK}`);

    // Input name manually
    await iframeType('#field_item_nama_peserta input[type="text"]', fixedData.nama);

    if (fixedData.gender !== 'Tidak Diketahui') {
      // Input gender
      await typeAndTriggerIframe(
        page,
        iframeSelector,
        '#field_item_jenis_kelamin_id input[type="text"]',
        fixedData.gender
      );
    } else {
      throw new Error(`Gender is not known for NIK: ${NIK}`);
    }

    // Try to find the birth date field in fixedData
    let tglLahir = fixedData['TGL LAHIR'] || fixedData.tgl_lahir;
    if (!moment(tglLahir, 'DD/MM/YYYY', true).isValid()) {
      throw new Error(`Invalid date format for TGL LAHIR: ${tglLahir} (NIK: ${NIK})`);
    } else {
      await typeAndTriggerIframe(page, iframeSelector, '#field_item_tgl_lahir input[type="text"]', tglLahir);
    }
    logLine('Resolved tglLahir: ' + tglLahir);

    // input address: provinsi -> kabupaten -> kecamatan -> kelurahan -> alamat
    if (fixedData.parsed_nik && fixedData.parsed_nik.status === 'success') {
      const parsed_nik = fixedData.parsed_nik.data;
      let { kotakab = '', namaKec = '', provinsi = '', kelurahan = [] } = parsed_nik;

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

  // Always input alamat
  if (fixedData.alamat && String(fixedData.alamat).trim() !== '') {
    await typeAndTriggerIframe(
      page,
      iframeSelector,
      '#field_item_alamat_ktp textarea[type="text"]',
      String(fixedData.alamat)
    );
  }

  // Input pekerjaan
  logLine(`Inputting pekerjaan: ${fixedData.pekerjaan} for NIK: ${NIK}`);
  await iframeType('input[name="pekerjaan_id_input"]', fixedData.pekerjaan);

  // Input berat badan and tinggi badan
  const bb = fixedData.bb || fixedData.BB || null;
  const tb = fixedData.tb || fixedData.TB || null;
  logLine(`Inputting berat badan (${bb}) dan tinggi badan (${tb}) untuk NIK: ${NIK}`);

  await iframeType('#field_item_berat_badan input[type="text"]', extractNumericWithComma(bb));
  await iframeType('#field_item_tinggi_badan input[type="text"]', extractNumericWithComma(tb));

  // Input tidak
  const tidakOptions = { clearFirst: true };

  await iframeType('#field_item_risiko_6_id input[type="text"]', fixedData.diabetes ? 'Ya' : 'Tidak', tidakOptions);
  // detach from active element
  await page.keyboard.press('Tab');

  if (fixedData.gender.toLowerCase().trim() === 'perempuan') {
    await iframeType('#field_item_risiko_9_id input[type="text"]', 'Tidak', tidakOptions);
    // detach from active element
    await page.keyboard.press('Tab');
  }

  if (!fixedData.batuk) {
    logLine(`Inputting batuk: Tidak ${fixedData.NAMA} (${NIK})`);
    await iframeType('#field_item_gejala_2_1_id input[type="text"]', 'Tidak', tidakOptions);
    // detach from active element
    await page.keyboard.press('Tab');
  } else {
    let keteranganBatuk = fixedData.batuk.replace(/ya,/, 'batuk');
    logLine(`Inputting batuk: ${keteranganBatuk} ${fixedData.NAMA} (${NIK})`);
    if (/\d/m.test(keteranganBatuk)) {
      await iframeType('#field_item_keterangan textarea', keteranganBatuk, tidakOptions);
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
    await iframeType(selector, 'Tidak', tidakOptions);
    // detach from active element
    await page.keyboard.press('Tab');
  }

  // detach from any active element
  await page.keyboard.press('Tab');

  await sleep(3000); // Wait for the form to stabilize

  // Prepare submit data

  const isAllowedToSubmit = async () => {
    const identityModalVisible = await isIdentityModalVisible(page);
    const invalidAlertVisible = await isInvalidAlertVisible(page);
    const nikErrorVisible = await isNikErrorVisible(page);
    const nikNotFoundModalVisible = await isNIKNotFoundModalVisible(page);

    logLine('identityModalVisible:', identityModalVisible);
    logLine('invalidAlertVisible:', invalidAlertVisible);
    logLine('nikErrorVisible:', nikErrorVisible);
    logLine('nikNotFoundModalVisible:', nikNotFoundModalVisible);
    return !identityModalVisible && !invalidAlertVisible && !nikErrorVisible && !nikNotFoundModalVisible;
  };

  await sleep(2000); // Wait for the form to stabilize

  // Re-evaluate the form to ensure all fields are filled correctly
  if (!(await isAllowedToSubmit())) {
    await re_evaluate(page);
  }

  while (!(await isAllowedToSubmit())) {
    // if (await isIframeElementVisible(page, iframeSelector, '#yesButton')) {
    //   break; // If the Yes button is visible, we can proceed
    // }
    logLine(`Submission not allowed for NIK: ${NIK}. Please check the form for errors.`);
    // Wait for user to fix data
    await waitEnter(`Please fix data for ${fixedData.NAMA} (${NIK}). Press Enter to continue...`);
  }

  if (await isAllowedToSubmit()) {
    logLine(`Submitting data for NIK: ${NIK}`);

    // Scroll to submit button
    await iframe.$eval('#save', (el) => el.scrollIntoView());
    // Click the submit button
    await clickIframeElement(page, iframeSelector, '#save');
    // Wait for the confirmation modal to appear
    await sleep(2000); // Wait for the modal to appear

    let counter = 0; // Counter for waiting for confirmation

    while (!(await isIframeElementVisible(page, iframeSelector, '#yesButton'))) {
      logInline(`Yes button is not visible for NIK: ${NIK} after ${counter}s. Please check the form for errors.`);
      await sleep(1000);
      counter++;
    }

    counter = 0; // Reset counter
    logLine(`Yes button is now visible for NIK: ${NIK}. Waiting for submission...`);

    while (!isAllowedToSubmit()) {
      logInline(`Submission not allowed for NIK: ${NIK} after ${counter}s. Please check the form for errors.`);
      await sleep(1000);
      counter++;
    }

    counter = 0; // Reset counter
    logLine(`Submission allowed for NIK: ${NIK}. Clicking Yes to confirm...`);

    // get form values before submission
    logLine(`Getting form values for NIK: ${NIK} before submission...`);
    const formValues = (await getFormValuesFromFrame(page, iframeSelector, '#main-container'))
      .map((item) => {
        if (!item.name || item.name.trim().length === 0) {
          return null; // Skip items without a name
        }
        if (item.isVisible.toLowerCase() === 'false') {
          return null; // Skip invisible elements
        }
        let valueLabel = item.value || '';
        if (valueLabel.trim().length === 0) {
          valueLabel = '<empty>';
        }
        let keyLabel = '';
        if (item.name && item.name.trim().length > 0) {
          keyLabel = `[name="${item.name}"]`;
        } else if (item.id && item.id.trim().length > 0) {
          keyLabel = `#${item.id}`;
        } else {
          keyLabel = '<empty-key>';
        }
        const isDisabled = item.disabled?.toLowerCase() === 'true';
        return {
          selector: keyLabel,
          value: valueLabel,
          disabled: isDisabled,
          label: item.label
        };
      })
      .filter((item) => item !== null);
    fixedData.formValues = formValues;

    // Click the Yes button to confirm submission
    await clickIframeElement(page, iframeSelector, '#yesButton');
  }

  await sleep(2000); // Wait for the submission to process

  if (!(await isElementVisible(page, iframeSelector))) {
    logLine(`Data for NIK: ${NIK} submitted successfully.`);
    // Get the form values after submission
    addLog({
      id: NIK,
      data: { ...fixedData, status: 'success' },
      message: `Data for NIK: ${NIK} submitted successfully.`
    });
  } else {
    logLine(`Data for NIK: ${NIK} submission failed. Please check the form for errors.`);
  }
}

async function re_evaluate(page) {
  const iframeSelector = '.k-window-content iframe.k-content-frame';
  const iframeElement = await page.$(iframeSelector);
  const iframe = await iframeElement.contentFrame();
  const iframeType = async (selector, value) => {
    // Check if element is visible and enabled
    const isVisibleAndEnabled = await iframe
      .$eval(selector, (el) => {
        const style = window.getComputedStyle(el);
        const notHidden =
          style && style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
        const notDisabled = !el.disabled && !el.readOnly;
        return notHidden && notDisabled;
      })
      .catch(() => false);
    if (!isVisibleAndEnabled) {
      logLine(`Element ${selector} is not visible or enabled, skipping typing.`);
      return;
    }
    // Scroll to the element before typing
    await iframe.$eval(selector, (el) => el.scrollIntoView({ behavior: 'auto', block: 'center' }));
    // Click to focus the element
    await iframe.click(selector).catch(() => {});
    await iframe.focus(selector).catch(() => {});
    // Try to clear the input using keyboard (Ctrl+A, Backspace)
    try {
      await iframe.click(selector, { clickCount: 3 });
      await iframe.type(selector, String.fromCharCode(1), { delay: 10 }); // Ctrl+A
      await iframe.keyboard.down('Control');
      await iframe.keyboard.press('A');
      await iframe.keyboard.up('Control');
      await iframe.keyboard.press('Backspace');
    } catch {
      // fallback to JS clear
      await page.evaluate(
        (iframeSelector, selector) => {
          const iframe = document.querySelector(iframeSelector);
          const element = iframe.contentDocument.querySelector(selector);
          if (element) {
            element.value = '';
            element.dispatchEvent(new iframe.contentWindow.Event('input', { bubbles: true }));
          }
        },
        iframeSelector,
        selector
      );
    }
    // Retry typing up to 3 times if value is not set
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await iframe.type(selector, value, { delay: 100 });
        // Wait for value to be set
        await iframe.waitForFunction(
          (sel, val) => {
            const el = document.querySelector(sel);
            return el && el.value && el.value.trim() === val.trim();
          },
          {},
          selector,
          value
        );
        // Trigger input and change events
        await iframe.$eval(selector, (el) => {
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
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
      return !value || value.trim() === '';
    } catch (err) {
      logLine(`Error checking input empty state for ${selector} with $eval: ${err}`);
      // Fallback: try to get value using JS evaluate
      try {
        const value = await page.evaluate(
          (iframeSelector, selector) => {
            const iframe = document.querySelector(iframeSelector);
            if (!iframe) return '';
            const el = iframe.contentDocument.querySelector(selector);
            return el ? el.value : '';
          },
          iframeSelector,
          selector
        );
        return !value || value.trim() === '';
      } catch (err2) {
        logLine(`Fallback JS evaluate failed for ${selector}: ${err2}`);
        return true; // Assume empty if error occurs
      }
    }
  };
  if (await isInputEmpty('#field_item_nama_peserta input[type="text"]'))
    await iframeType('#field_item_metode_id input[type="text"]', 'Tunggal');
  if (await isInputEmpty('input[name="tempat_skrining_id_input"]'))
    await iframeType('input[name="tempat_skrining_id_input"]', 'Puskesmas');
}

async function _testSkriningData() {
  const dataKunto = await loadCsvData();
  console.log(dataKunto[0]);
  console.log('total data:', dataKunto.length);
}

const _main = async () => {
  const { page, browser } = await getPuppeteer();
  await skrinLogin(page);
  /**
   * @type {import('./types.js').SkrinData[]}
   */
  const dataKunto = await loadCsvData();

  // Fix data names
  for (let i = 0; i < dataKunto.length; i++) {
    if (/bayi/i.test(dataKunto[i].nama)) {
      const namaBayi = parseBabyName(dataKunto[i].nama);
      if (namaBayi) {
        logLine(`Parsed baby name: ${dataKunto[i].nama} -> ${ansiColors.green(namaBayi)}`);
        dataKunto[i].nama = namaBayi;
      } else {
        logLine(`Failed to parse baby name: ${dataKunto[i].nama}`);
        // dataKunto[i].skip = true; // Mark to skip
      }
    }
  }

  if (cliArgs.shuffle) {
    // Shuffle data array using Fisher-Yates algorithm
    for (let i = dataKunto.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dataKunto[i], dataKunto[j]] = [dataKunto[j], dataKunto[i]];
    }
    logLine('Data shuffled');
  }

  const unprocessedData = dataKunto.filter((item) => {
    // Check if the data for this NIK has already been processed
    const nik = getNumbersOnly(item.nik);
    return !getLogById(nik) || Object.hasOwn(getLogById(nik).data, 'status') === false;
  });

  const isSingle = cliArgs.single ? true : false;

  if (!isSingle) {
    while (unprocessedData.length > 0) {
      const currentData = unprocessedData.shift();
      if (currentData.skip) {
        continue; // Skip this entry
      }
      if (!nikUtils.isValidNIK(currentData.nik)) {
        logLine(`Skipping invalid NIK: ${currentData.nik}`);
        addLog({
          id: getNumbersOnly(currentData.nik),
          data: { ...currentData, status: 'invalid' },
          message: 'Invalid NIK format'
        });
        continue; // Skip invalid NIKs
      }
      // Close the first page if there are more than 3 pages open
      if ((await browser.pages()).length > 3) {
        const pages = await browser.pages();
        await pages[0].close();
      }
      // Start new page for each data entry
      if (currentData) await processData(await browser.newPage(), currentData);
      // Log remaining unprocessed data count
      logLine(`Remaining unprocessed data: ${unprocessedData.length}`);
    }
  } else {
    // Single mode - process only the first unprocessed data
    if (unprocessedData.length > 0) {
      const currentData = unprocessedData[0];
      if (currentData.skip) {
        logLine('The first unprocessed data is marked to skip. Exiting single mode.');
      } else if (!nikUtils.isValidNIK(currentData.nik)) {
        logLine(`Skipping invalid NIK: ${currentData.nik}`);
        addLog({
          id: getNumbersOnly(currentData.nik),
          data: { ...currentData, status: 'invalid' },
          message: 'Invalid NIK format'
        });
      } else {
        await processData(page, currentData);
      }
    } else {
      logLine('No unprocessed data available for single mode.');
    }
  }
};

if (cliArgs.help) {
  showHelp();
  process.exit(0);
} else {
  (async () => {
    try {
      await _main();
      logLine('All done!');
      process.exit(0);
    } catch (err) {
      console.error('Fatal error:', err);
      process.exit(1);
    }
  })();
}
