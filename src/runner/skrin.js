import dotenv from 'dotenv';
import minimist from 'minimist';
import moment from 'moment';
import * as nikUtils from 'nik-parser-jurusid/index';
import path from 'path';
import { array_random, isEmpty } from 'sbg-utility';
import { fileURLToPath } from 'url';
import { loadCsvData } from '../../data/index.js';
import { geocodeWithNominatim } from '../address/nominatim.js';
import { playMp3FromUrl } from '../beep.js';
import { addLog, getLogById } from '../database/SQLiteLogDatabase.js';
import {
  closeOtherTabs,
  getFormValues,
  getPuppeteer,
  isElementExist,
  isElementVisible,
  typeAndTrigger
} from '../puppeteer_utils.js';
import { enterSkriningPage, skrinLogin } from '../skrin_puppeteer.js';
import {
  confirmIdentityModal,
  getPersonInfo,
  isIdentityModalVisible,
  isInvalidAlertVisible,
  isNikErrorVisible,
  isNIKNotFoundModalVisible,
  isSuccessNotificationVisible
} from '../skrin_utils.js';
import { extractNumericWithComma, getNumbersOnly, sleep, waitEnter } from '../utils.js';
import { ucwords } from '../utils/string.js';
import { fixData } from '../xlsx-helper.js';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Re-evaluates the form by re-typing the "metode_id_input" field to trigger any dynamic changes on the page.
 *
 * This function is used to ensure that any dependent fields or validations that rely on the "metode_id_input" value are properly updated after changes to the form.
 *
 * @async
 * @param {import('puppeteer').Page} page
 */
async function reEvaluate(page) {
  await typeAndTrigger(page, 'input[name="metode_id_input"]', 'Tunggal');
}

/**
 * Processes a single row of Excel data by automating the form-filling process on the skrining site.
 *
 * Steps include navigating pages, inputting data, checking for various modals and alerts,
 * correcting job/location fields, and submitting the form.
 *
 * @param {import('puppeteer').Page} page - The Puppeteer page instance used to interact with the skrining form.
 * @param {import('../../globals.js').ExcelRowData} data - A single row of Excel data to be submitted through the form.
 * @returns {Promise<{
 *   status: 'success' | 'error',
 *   reason?: 'invalid_nik_length' | 'data_not_found' | string,
 *   description?: string,
 *   data?: import('../../globals.js').ExcelRowData
 * }>} Result of the processing. On success, status is 'success' with the processed data. On failure, status is 'error' with reason and description.
 * @throws {Error} If required fields are missing or an unexpected state is encountered.
 */
export async function processData(page, data) {
  await page.setDefaultTimeout(0);
  await page.setDefaultNavigationTimeout(0);

  await page.waitForSelector('#nik', { visible: true });
  await sleep(3000);

  if (!data) {
    throw new Error('No more data to process.');
  }

  const NIK = data.nik;
  if (!nikUtils.isValidNIK(NIK)) {
    addLog({
      id: getNumbersOnly(NIK),
      data: { ...fixedData, status: 'invalid' },
      message: 'Invalid NIK format'
    });
    console.error(`Skipping due to invalid NIK format: ${NIK}`);
    return {
      status: 'error',
      reason: 'invalid_nik_format',
      description: `Skipping due to invalid NIK format: ${NIK}`
    };
  }

  // Fix and normalize data before processing
  const fixedData = await fixData(data, { autofillTanggalEntry: true, fixNamaBayi: true });
  /** @type {import('nik-parser-jurusid').NikParseResult} */
  const parsedNik = fixedData.parsed_nik || (await nikUtils.nikParse(fixedData.nik));

  console.log('Processing:', fixedData);

  const tanggalEntry = fixedData['TANGGAL ENTRY'] || fixedData.tanggal;

  if (!`${tanggalEntry}`.includes('/') || !tanggalEntry || tanggalEntry.length < 8) {
    throw new Error(
      `INVALID DATE: tanggal=${String(tanggalEntry)} (type=${typeof tanggalEntry}) - data=${JSON.stringify(
        fixedData,
        null,
        2
      )}`
    );
  }

  const parseTanggal = moment(tanggalEntry, 'DD/MM/YYYY', true); // strict parsing

  if (!parseTanggal.isValid()) {
    throw new Error(
      `INVALID DATE (parse failed): tanggal=${String(tanggalEntry)} (type=${typeof tanggalEntry}) - data=${JSON.stringify(
        fixedData,
        null,
        2
      )}`
    );
  }

  if (parseTanggal.day() === 0) {
    // Sunday
    throw new Error(`SUNDAY DATE NOT ALLOWED: ${tanggalEntry}`);
  }

  await page.$eval('#dt_tgl_skrining', (el) => el.removeAttribute('readonly'));
  await typeAndTrigger(page, '#dt_tgl_skrining', tanggalEntry);
  await page.$eval('#dt_tgl_skrining', (el) => el.setAttribute('readonly', 'true'));
  await typeAndTrigger(page, 'input[name="metode_id_input"]', 'Tunggal');
  await typeAndTrigger(page, 'input[name="tempat_skrining_id_input"]', 'Puskesmas');
  await typeAndTrigger(page, '#nik', getNumbersOnly(NIK));

  await sleep(5000);

  // Check if the ID modal appears
  try {
    await page.waitForSelector('.k-widget.k-window.k-window-maximized', { timeout: 5000 });
    // console.log('Modal is visible');
  } catch (_e) {
    // console.log('Modal did not appear');
  }

  try {
    await page.waitForSelector('[aria-labelledby="dialogconfirm_wnd_title"]', { visible: true, timeout: 5000 });
  } catch (_e) {
    //
  }

  console.log('Is NIK error notification visible:', await isNikErrorVisible(page));
  if (await isNikErrorVisible(page)) {
    waitEnter('Please check NIK error notification. Press Enter to continue...');
    throw new Error('NIK error notification visible, please re-check. Aborting...');
  }

  console.log('Identity modal is visible:', await isIdentityModalVisible(page));

  if (await isIdentityModalVisible(page)) {
    await confirmIdentityModal(page);
  }

  // Check if NIK not found modal visible
  const isNikNotFound = await isNIKNotFoundModalVisible(page);
  console.log('Is NIK not found modal visible:', isNikNotFound);

  if (isNikNotFound) {
    // Input manual data from parsed NIK if available

    const shouldClickYes = await page.evaluate(() => {
      const dialog = document.querySelector('#dialogconfirm');
      if (!dialog) return false;

      const text = (dialog.innerText || dialog.textContent || '').toLowerCase();
      return (
        text.includes('access to resources is temporary closed'.toLowerCase()) &&
        text.includes('Apakah Anda akan melanjutkan penginputan manual?'.toLowerCase())
      );
    });

    if (shouldClickYes) {
      await page.click('#yesButton');

      const NAMA = fixedData.nama || fixedData.NAMA || '';
      if (!NAMA || NAMA.length === 0) {
        throw new Error("❌ Failed to take the patient's name");
      }
      await typeAndTrigger(page, '#field_item_nama_peserta input[type="text"]', NAMA);

      if (!fixedData.genderInitial) {
        throw new Error("❌ Failed to determine patient's gender from NIK");
      }

      await typeAndTrigger(page, '#field_item_jenis_kelamin_id input[type="text"]', fixedData.gender);

      // Validate final birth date format to ensure it's in DD/MM/YYYY
      // If invalid, throw an error with context for easier debugging
      const parsedLahir = moment(fixedData.tgl_lahir, ['DD/MM/YYYY', 'YYYY-MM-DD'], true);
      if (!parsedLahir.isValid()) {
        throw new Error(`❌ Invalid birth date format from NIK, expected DD/MM/YYYY, got: ${fixedData.tgl_lahir}`);
      }

      await typeAndTrigger(page, '#field_item_tgl_lahir input[type="text"]', parsedLahir.format('DD/MM/YYYY'));

      if (!fixedData.alamat || fixedData.alamat.length === 0) {
        throw new Error("❌ Failed to take the patient's address");
      }

      let kotakab = '',
        kecamatan = '',
        provinsi = '',
        kelurahan = '';

      const keywordAddr = `${fixedData.alamat} Surabaya, Jawa Timur`.trim();
      const geocodedAddress = await geocodeWithNominatim(keywordAddr);
      if (geocodedAddress) {
        fixedData._address = geocodedAddress;

        // Avoid destructuring: explicitly read values from parsedNik.data (if present)
        const _parsedNikData = parsedNik && parsedNik.data ? parsedNik.data : {};
        kotakab = _parsedNikData.kotakab || '';
        kecamatan = _parsedNikData.kecamatan || '';
        provinsi = _parsedNikData.provinsi || '';
        kelurahan = _parsedNikData.kelurahan || '';

        if (kotakab.length === 0 || kecamatan.length === 0 || provinsi.length === 0) {
          console.log(`Fetching address from Nominatim for: ${keywordAddr}`);
          console.log('Nominatim result:', geocodedAddress);

          const addr = geocodedAddress.address || {};

          if (kelurahan.length === 0) kelurahan = addr.village || addr.hamlet || '';
          if (kecamatan.length === 0) kecamatan = addr.suburb || addr.city_district || '';
          if (kotakab.length === 0) kotakab = addr.city || addr.town || addr.village || 'Kota Surabaya';
          if (provinsi.length === 0) provinsi = addr.state || addr.province || 'Jawa Timur';

          if (kotakab.toLowerCase().includes('surabaya')) {
            kotakab = 'Kota Surabaya';
          }

          if (kotakab.length === 0 || kecamatan.length === 0) {
            throw new Error("❌ Failed to take the patient's city or town");
          }
        }
      }

      if (typeof kelurahan !== 'string' || isEmpty(kelurahan)) {
        if (fixedData.parsed_nik && fixedData.parsed_nik.status === 'success') {
          const parsed_nik = fixedData.parsed_nik.data;
          let parsedKelurahan;
          // Explicit assignments instead of destructuring. Note: `namaKec` maps to `kecamatan`.
          if (parsed_nik) {
            kotakab = parsed_nik.kotakab || '';
            kecamatan = parsed_nik.namaKec || '';
            provinsi = parsed_nik.provinsi || '';
            parsedKelurahan = parsed_nik.kelurahan != null ? parsed_nik.kelurahan : null;
          } else {
            kotakab = '';
            kecamatan = '';
            provinsi = '';
            parsedKelurahan = null;
          }
          const selectedKelurahan =
            Array.isArray(parsedKelurahan) && parsedKelurahan.length > 0 ? parsedKelurahan[0] : parsedKelurahan || null;
          kelurahan = selectedKelurahan ? selectedKelurahan.name || selectedKelurahan : '';
          console.log(
            `Using parsed NIK data for address: ${selectedKelurahan && selectedKelurahan.name ? selectedKelurahan.name : '<unknown kelurahan>'}, ${
              kecamatan || '<unknown kec>'
            }, ${kotakab || '<unknown kota>'}, ${provinsi || '<unknown provinsi>'}`
          );
        } else {
          throw new Error(
            `❌ Failed to determine address: no Nominatim result and no parsed NIK data available (nik=${fixedData.nik || '<unknown>'}, alamat=${fixedData.alamat || '<unknown>'})`
          );
        }
      }

      // ensure kelurahan string
      if (typeof kelurahan != 'string') {
        console.log({ provinsi, kotakab, kecamatan, kelurahan });
        throw new Error('kelurahan should be string');
      }

      // Ensure provinsi, kotakab, kecamatan, kelurahan not empty — throw descriptive error
      if (isEmpty(provinsi) || isEmpty(kotakab) || isEmpty(kecamatan) || isEmpty(kelurahan)) {
        throw new Error(
          `Missing required address fields: provinsi='${provinsi || ''}', kotakab='${kotakab || ''}', kecamatan='${kecamatan || ''}', kelurahan='${kelurahan || ''}'`
        );
      } else {
        console.log(`Inputting address ${provinsi} -> ${kotakab} -> ${kecamatan} -> ${kelurahan}`);
      }

      // Input provinsi -> kabupaten -> kecamatan -> kelurahan -> alamat
      await typeAndTrigger(page, '#field_item_provinsi_ktp_id input[type="text"]', ucwords(provinsi));
      await typeAndTrigger(page, '#field_item_kabupaten_ktp_id input[type="text"]', ucwords(kotakab));
      await typeAndTrigger(page, '#field_item_kecamatan_ktp_id input[type="text"]', ucwords(kecamatan));
      await typeAndTrigger(page, '#field_item_kelurahan_ktp_id input[type="text"]', ucwords(kelurahan));
      await typeAndTrigger(page, '#field_item_alamat_ktp textarea[type="text"]', fixedData.alamat);
    } else {
      // If the modal does not contain the expected text, we assume it's a different issue
      return {
        status: 'error',
        reason: 'data_not_found',
        description: 'Skipping due data not found'
      };
    }
  }

  // Get the patient's name from the form after confirming identity (or if no modal appeared)
  const nama = await page.evaluate(() => document.querySelector('input[name="nama_peserta"]')?.value);
  fixedData.nama_from_page = `${nama}`.trim();
  // re-check
  if (isEmpty(`${fixedData.nama_from_page}`)) {
    throw new Error("❌ Failed to take the patient's name");
  }

  const { gender, age, birthDate, location } = await getPersonInfo(page);
  const { province, city } = location;
  fixedData.gender_from_page = gender;
  fixedData.tgl_lahir_from_page = birthDate;
  fixedData.umur_from_page = age;
  console.log('Jenis kelamin:', gender, 'Umur:', age, 'tahun');
  if (!gender || isNaN(age)) {
    throw new Error('Invalid input: Gender or age is missing/invalid.');
  }

  // Fix if location data is empty
  console.log(`Provinsi: ${province}`, province.length == 0 ? '(empty)' : '');
  if (province.length == 0) {
    await typeAndTrigger(page, '#field_item_provinsi_ktp_id input[type="text"]', 'Jawa Timur');
  }

  console.log(`Kabupaten/Kota: ${city}`, city.length == 0 ? '(empty)' : '');
  if (city.length == 0) {
    await typeAndTrigger(page, '#field_item_kabupaten_ktp_id input[type="text"]', 'Kota Surabaya');
  }

  // Fix job
  fixedData.pekerjaan_original = data.pekerjaan;
  console.log(`Pekerjaan: ${fixedData.pekerjaan}`);

  await typeAndTrigger(page, 'input[name="pekerjaan_id_input"]', fixedData.pekerjaan);

  // Input tinggi dan berat badan
  const bb = fixedData.bb || fixedData.BB || null;
  const tb = fixedData.tb || fixedData.TB || null;
  console.log(`Inputting berat badan (${bb}) dan tinggi badan (${tb}) untuk NIK: ${NIK}`);

  await page.focus('#field_item_berat_badan input[type="text"]');
  await page.type('#field_item_berat_badan input[type="text"]', extractNumericWithComma(bb), { delay: 100 });
  await page.focus('#field_item_tinggi_badan input[type="text"]');
  await page.type('#field_item_tinggi_badan input[type="text"]', extractNumericWithComma(tb), { delay: 100 });

  // Batch fill common "Tidak" selections to reduce repeated awaits
  const defaultNoSelectors = [
    '#field_item_riwayat_kontak_tb_id input[type="text"]',
    '#field_item_risiko_1_id input[type="text"]',
    '#field_item_risiko_4_id input[type="text"]',
    '#field_item_risiko_5_id input[type="text"]',
    '#field_item_risiko_7_id input[type="text"]',
    '#field_item_risiko_10_id input[type="text"]',
    '#field_item_risiko_11_id input[type="text"]',
    '#field_item_gejala_2_3_id input[type="text"]',
    '#field_item_gejala_2_4_id input[type="text"]',
    '#field_item_gejala_2_5_id input[type="text"]',
    '#field_item_gejala_6_id input[type="text"]',
    '#field_item_cxr_pemeriksaan_id input[type="text"]'
  ];

  // Add gender-specific selector
  if (gender.toLowerCase().trim() == 'perempuan') {
    defaultNoSelectors.push('#field_item_risiko_9_id input[type="text"]');
  }

  for (const sel of defaultNoSelectors) {
    await typeAndTrigger(page, sel, 'Tidak');
  }

  // Handle diabetes separately (Yes/No)
  await typeAndTrigger(page, '#field_item_risiko_6_id input[type="text"]', fixedData.diabetes ? 'Ya' : 'Tidak');

  if (age < 18) {
    const gejalaBalitaSelectors = [
      '#field_item_gejala_1_1_id input[type="text"]',
      '#field_item_gejala_1_3_id input[type="text"]',
      '#form_item_gejala_1_4_id input[type="text"]',
      '#field_item_gejala_1_5_id input[type="text"]'
    ];

    for (const gejalaBalitaSelector of gejalaBalitaSelectors) {
      if (await isElementExist(page, gejalaBalitaSelector)) {
        const visible = await isElementVisible(page, gejalaBalitaSelector);
        console.log(`Gejala balita ${gejalaBalitaSelector} is visible ${visible}`);

        if (visible) {
          await typeAndTrigger(page, gejalaBalitaSelector, 'Tidak');
          await sleep(200);
        }
      }
    }
  }

  await page.keyboard.press('Tab');

  if (!fixedData.batuk) {
    await typeAndTrigger(page, '#field_item_gejala_2_1_id input[type="text"]', 'Tidak');
  } else {
    let keteranganBatuk = fixedData.batuk.replace(/ya,/, 'batuk');
    if (/\d/m.test(keteranganBatuk)) {
      await typeAndTrigger(page, '#field_item_keterangan textarea', keteranganBatuk);
      await waitEnter('Please fix data batuk/demam. Press Enter to continue...');
    }
  }

  await sleep(2000);

  // Re-check if the identity modal is visible
  while (await isIdentityModalVisible(page)) {
    // Confirm identity modal
    await confirmIdentityModal(page);
    await sleep(1000);
    // Re-check
    if (await isIdentityModalVisible(page)) {
      await waitEnter('Please check identity modal. Press Enter to continue...');
    }
  }

  // Check if the invalid element alert is visible
  while (await isInvalidAlertVisible(page)) {
    // Solve common problems
    await typeAndTrigger(page, 'input[name="metode_id_input"]', 'Tunggal');
    await typeAndTrigger(page, 'input[name="tempat_skrining_id_input"]', 'Puskesmas');
    await typeAndTrigger(page, 'input[name="pekerjaan_id_input"]', fixedData.pekerjaan);

    // Re-check
    if (await isInvalidAlertVisible(page)) await reEvaluate(page);
    if (await isInvalidAlertVisible(page)) {
      console.warn('⚠️ Invalid alert detected for the following data:');
      console.dir(fixedData, { depth: null });
      await waitEnter('Please review the alert and press Enter to continue...');
    }
  }

  // Auto submit
  let hasSubmitted;
  const identityModalVisible = await isIdentityModalVisible(page);
  const invalidAlertVisible = await isInvalidAlertVisible(page);
  const nikErrorVisible = await isNikErrorVisible(page);
  const nikNotFoundModalVisible = await isNIKNotFoundModalVisible(page);

  console.log('identityModalVisible:', identityModalVisible);
  console.log('invalidAlertVisible:', invalidAlertVisible);
  console.log('nikErrorVisible:', nikErrorVisible);
  console.log('nikNotFoundModalVisible:', nikNotFoundModalVisible);

  const isAllowedToSubmit =
    !identityModalVisible && !invalidAlertVisible && !nikErrorVisible && !nikNotFoundModalVisible;
  console.log('isAllowedToSubmit:', isAllowedToSubmit);
  if (isAllowedToSubmit) {
    // get form values before submission
    console.log(`Getting form values for NIK: ${NIK} before submission...`);
    const formValues = (await getFormValues(page, '#main-container'))
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

    console.log(`Form values for NIK: ${NIK}:`, formValues);

    // Clck the save button
    console.log('Clicking the save button...');
    await page.$eval('#save', (el) => el.scrollIntoView());
    await page.evaluate(() => {
      const el = document.querySelector('#save');
      if (el) {
        el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      }
    });

    await sleep(1000);
    try {
      // Wait for the confirmation modal to appear
      await page.waitForSelector('#yesButton', { visible: true });
      // Click the "Ya" button
      await page.click('#yesButton');
    } catch (_) {
      // Fail sending data, press manually
      waitEnter(
        'Failed to click #yesButton for confirmation modal. Please click the button manually, then press Enter to continue...'
      );
    }

    await sleep(1000);
    while (true) {
      const isSuccessVisible = await isSuccessNotificationVisible(page);
      if (isSuccessVisible) {
        console.log('✅ Success notification is visible');
        break;
      }
      // Optional: wait a bit to avoid tight loop
      await new Promise((r) => setTimeout(r, 1000));
      if (Date.now() % 5000 < 1000) {
        console.log('Waiting for success notification modal to be visible...');
      }
    }

    hasSubmitted = true;
  } else {
    hasSubmitted = false;
  }

  if (hasSubmitted) {
    console.log('✅\tData submitted successfully:', fixedData);
  } else {
    console.warn('⚠️\tData processed but not submitted:', fixedData);
    await waitEnter('Press Enter to continue...');
  }

  addLog({
    id: getNumbersOnly(NIK),
    data: { ...fixedData, status: 'success' },
    message: `Data for NIK: ${NIK} submitted successfully.`
  });

  return {
    status: 'success',
    data: fixedData
  };
}

/**
 * Main function to automate processing of multiple rows of Excel data for skrining entry.
 *
 * Logs into the web application, iterates through the data entries, and processes each one using `processData`.
 * Optionally allows transformation of each row of data through a callback before processing.
 *
 * @param {{browser: import('puppeteer').Browser, page: import('puppeteer').Page}} puppeteerInstance
 *   Puppeteer instance created by `getPuppeteer()` (an object with `browser` and `page`).
 *   When provided, `runEntrySkrining` will use this instance and will not create/close the browser itself —
 *   this allows the caller (for example a supervisor main loop) to reuse the browser across restarts.
 * @param {(data: import('../../globals.js').ExcelRowData) => import('../../globals.js').ExcelRowData | Promise<import('../../globals.js').ExcelRowData>} [dataCallback]
 *   A callback to optionally transform each Excel data row before processing. Can be synchronous or asynchronous.
 *   Defaults to an identity function if not provided.
 * @returns {Promise<void>} A promise that resolves when all data entries are processed. The browser is not closed by this
 *   function when a `puppeteerInstance` is supplied; the caller is responsible for closing it.
 */
export async function runEntrySkrining(puppeteerInstance, dataCallback = (data) => data) {
  // const datas = getXlsxData(process.env.index_start, process.env.index_end);
  // const datas = await fetchXlsxData3(process.env.index_start, process.env.index_end);
  let datas = await loadCsvData();
  // Parse CLI flags using minimist: support --single and --shuffle
  const args = minimist(process.argv.slice(2));
  const flagSingle = Boolean(args.single);
  const flagShuffle = Boolean(args.shuffle);

  if (flagShuffle && Array.isArray(datas) && datas.length > 1) {
    // Fisher-Yates shuffle
    for (let i = datas.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [datas[i], datas[j]] = [datas[j], datas[i]];
    }
    console.log('Shuffled data ordering due to --shuffle flag');
  }

  if (flagSingle && Array.isArray(datas) && datas.length > 0) {
    datas = [datas[0]];
    console.log('Processing single entry due to --single flag');
  }

  const puppeteer = puppeteerInstance;
  const page = puppeteer.page;
  const browser = puppeteer.browser;

  await skrinLogin(page);

  while (datas.length > 0) {
    /**
     * @type {import('../../globals.js').ExcelRowData}
     */
    const data = await dataCallback(datas.shift()); // <-- modify the data via callback
    const existing = getLogById(getNumbersOnly(data.nik));
    if (existing && existing.data) {
      const status = existing.data.status || 'unknown';
      const message = existing.message || '';
      console.log(`Data for NIK ${data.nik} already processed. Skipping. Status: ${status}. Message: ${message}`);
      continue;
    }

    await closeOtherTabs(page);

    const processPage = array_random(await browser.pages());
    try {
      await enterSkriningPage(page);
    } catch (e) {
      await playMp3FromUrl('https://assets.mixkit.co/active_storage/sfx/1084/1084.wav').catch(console.error);
      throw e;
    }

    const result = await processData(processPage, data);
    if (result.status === 'error') {
      console.error(Object.assign(result, { data }));
      break; // stop processing further on error, to allow investigation and fixes
    } else if (result.status !== 'success') {
      console.warn('Unexpected result status:', result.status, result);
      process.exit(1); // exit on unexpected status to avoid silent failures
    }
  }

  console.log('All data processed.');

  // Completed run - database logging used instead of HTML log builds
}

export async function executeSkriningProcess() {
  let puppeteerInstance;
  try {
    puppeteerInstance = await getPuppeteer();
  } catch (e) {
    console.error('Failed to launch puppeteer:', e && e.stack ? e.stack : e);
    setTimeout(() => process.exit(1), 100);
    return;
  }

  while (true) {
    try {
      await runEntrySkrining(puppeteerInstance);
      break; // finished successfully
    } catch (err) {
      const msg =
        err && (err.stack || err.message || String(err)) ? err.stack || err.message || String(err) : String(err);
      console.error('Unhandled error in runEntrySkrining:', msg);
      const lowerMsg = String(msg).toLowerCase();
      if (lowerMsg.includes('net::err_connection_timed_out') || lowerMsg.includes('navigation timeout')) {
        console.warn('Detected connection/navigation timeout — restarting in 1s...');
        await sleep(1000);
        continue; // restart loop, reuse puppeteerInstance
      }

      // non-recoverable error: close browser then exit
      try {
        await puppeteerInstance.browser.close();
      } catch (e) {
        console.error('Failed to close browser after error:', e && e.stack ? e.stack : e);
      }

      // give some time for stdout/stderr to flush, then exit with failure
      setTimeout(() => process.exit(1), 100);
      break;
    }
  }

  // finished successfully, close browser
  try {
    await puppeteerInstance.browser.close();
  } catch (e) {
    console.error('Failed to close browser on exit:', e && e.stack ? e.stack : e);
  }
}

// if ('skrin' === path.basename(__filename, '.js')) {
//   executeSkriningProcess();
// }
