import { spawnAsync } from 'cross-spawn';
import dotenv from 'dotenv';
import moment from 'moment';
import readline from 'node:readline';
import path from 'path';
import { fileURLToPath } from 'url';
import { playMp3FromUrl } from './src/beep.js';
import { getPuppeteer, isElementExist, isElementVisible, typeAndTrigger } from './src/puppeteer_utils.js';
import {
  confirmIdentityModal,
  fixTbAndBb,
  getPersonInfo,
  isIdentityModalVisible,
  isInvalidAlertVisible,
  isNikErrorVisible,
  isNIKNotFoundModalVisible,
  isSuccessNotificationVisible
} from './src/skrin_utils.js';
import { appendLog, extractNumericWithComma, getNumbersOnly, singleBeep, sleep, ucwords } from './src/utils.js';
import { fetchXlsxData3 } from './xlsx_data.js';

// Get the absolute path of the current script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Prompts the user to press Enter with an optional sound beep before continuing execution.
 *
 * @param {string} message - The message to display in the terminal prompt.
 * @param {boolean} [sound=true] - Whether to play a beep sound before prompting.
 * @returns {Promise<void>} A promise that resolves when the user presses Enter.
 */
function waitEnter(message, sound = true) {
  return new Promise(function (resolve) {
    if (sound) singleBeep();
    rl.question(message, resolve);
  });
}

/**
 * Executes scripts to build and analyze the HTML log.
 *
 * Used to generate reports from the processing results by running `log-builder.js` and `log-analyzer.js`.
 *
 * @returns {Promise<void>} A promise that resolves when the log building process is complete.
 */
async function buildHtmlLog() {
  await spawnAsync('node', [path.resolve(process.cwd(), 'log-builder.js')], {
    cwd: process.cwd(),
    stdio: 'inherit'
  });
  await spawnAsync('node', [path.resolve(process.cwd(), 'log-analyzer.js')], {
    cwd: process.cwd(),
    stdio: 'inherit'
  });
}

/**
 * Processes a single row of Excel data by automating the form-filling process on the skrining site.
 *
 * Steps include navigating pages, inputting data, checking for various modals and alerts,
 * correcting job/location fields, and submitting the form.
 *
 * @async
 * @function processData
 * @param {import('puppeteer').Browser} browser - The Puppeteer browser instance used to open and interact with web pages.
 * @param {import('./globals.js').ExcelRowData} data - A single row of Excel data to be submitted through the form.
 * @returns {Promise<{
 *   status: 'success' | 'error',
 *   reason?: 'invalid_nik_length' | 'data_not_found' | string,
 *   description?: string,
 *   data?: import('./globals.js').ExcelRowData
 * }>} Result of the processing. On success, status is 'success' with the processed data. On failure, status is 'error' with reason and description.
 * @throws {Error} If required fields are missing or an unexpected state is encountered.
 */
export async function processData(browser, data) {
  const page = await browser.newPage(); // Open new tab

  // Close the first tab when there are more than 2 open tabs
  const pages = await browser.pages(); // Get all open pages (tabs)
  if (pages.length > 3) {
    await pages[0].close(); // Close the first tab
  }

  try {
    await page.goto('https://sumatera.sitb.id/sitb2024/skrining', {
      waitUntil: 'networkidle2',
      timeout: 120000
    });

    await page.waitForSelector('#btnAdd_ta_skrining', { visible: true });
    await page.click('#btnAdd_ta_skrining');

    await page.goto('https://sumatera.sitb.id/sitb2024/Skrining/add', {
      waitUntil: 'networkidle2',
      timeout: 120000
    });
  } catch (e) {
    await playMp3FromUrl('https://assets.mixkit.co/active_storage/sfx/1084/1084.wav').catch(console.error);
    console.error('Error navigating to skrining page:', e.message);
    // Repeat
    return processData(browser, data);
  }

  await page.waitForSelector('#nik', { visible: true });
  await sleep(3000);

  if (!data) {
    throw new Error('No more data to process.');
  }

  console.log('Processing:', data);

  if (!`${data.tanggal}`.includes('/') || !data.tanggal || data.tanggal.length < 8) {
    await browser.close();
    throw new Error(`INVALID DATE ${JSON.stringify(data, null, 2)}`);
  }

  const parseTanggal = moment(data.tanggal, 'DD/MM/YYYY', true); // strict parsing

  if (!parseTanggal.isValid()) {
    await browser.close();
    throw new Error(`INVALID DATE ${JSON.stringify(data, null, 2)}`);
  }

  if (parseTanggal.day() === 0) {
    // Sunday
    await browser.close();
    throw new Error(`SUNDAY DATE NOT ALLOWED: ${data.tanggal}`);
  }

  await page.$eval('#dt_tgl_skrining', (el) => el.removeAttribute('readonly'));
  await typeAndTrigger(page, '#dt_tgl_skrining', data.tanggal);
  await page.$eval('#dt_tgl_skrining', (el) => el.setAttribute('readonly', 'true'));
  await typeAndTrigger(page, 'input[name="metode_id_input"]', 'Tunggal');
  await typeAndTrigger(page, 'input[name="tempat_skrining_id_input"]', 'Puskesmas');

  if (data.nik.length < 16) {
    console.error('Skipping due NIK length invalid, should be 16 digits.');
    appendLog(data, 'Invalid Data');
    // Build HTML log
    buildHtmlLog();
    return {
      status: 'error',
      reason: 'invalid_nik_length',
      description: 'Skipping due NIK length invalid, should be 16 digits.'
    };
  }

  await typeAndTrigger(page, '#nik', getNumbersOnly(data.nik));

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

      if (!data.nama || data.nama.length === 0) {
        throw new Error("❌ Failed to take the patient's name");
      }
      await typeAndTrigger(page, '#field_item_nama_peserta input[type="text"]', data.nama);

      if (!data.parsed_nik) {
        throw new Error('❌ Failed to parse NIK data');
      }
      const parsed_nik_gender = data.parsed_nik.kelamin.toLowerCase() == 'laki-laki' ? 'Laki-laki' : 'Perempuan';
      console.log(`Gender ${parsed_nik_gender} detected from NIK`);
      await typeAndTrigger(page, '#field_item_jenis_kelamin_id input[type="text"]', parsed_nik_gender);

      // Attempt to parse the birth date assuming MM/DD/YYYY format (common in US data)
      // If valid, convert and reformat to DD/MM/YYYY (standard format expected in our system)
      const parseMMDDYYYY = moment(data.parsed_nik.lahir, 'MM/DD/YYYY', true);
      if (parseMMDDYYYY.isValid()) {
        data.parsed_nik.lahir = parseMMDDYYYY.format('DD/MM/YYYY');
        console.warn(`⚠️ Detected MM/DD/YYYY format, converted to DD/MM/YYYY: ${data.parsed_nik.lahir}`);
      }

      // Validate final birth date format to ensure it's in DD/MM/YYYY
      // If invalid, throw an error with context for easier debugging
      const parsedLahir = moment(data.parsed_nik.lahir, 'DD/MM/YYYY', true);
      if (!parsedLahir.isValid()) {
        throw new Error(`❌ Invalid birth date format from NIK, expected DD/MM/YYYY, got: ${data.parsed_nik.lahir}`);
      }

      await typeAndTrigger(page, '#field_item_tgl_lahir input[type="text"]', data.parsed_nik.lahir);

      const { kotakab, kecamatan, provinsi } = data.parsed_nik;
      await typeAndTrigger(page, '#field_item_provinsi_ktp_id input[type="text"]', ucwords(provinsi));
      await typeAndTrigger(page, '#field_item_kabupaten_ktp_id input[type="text"]', ucwords(kotakab));
      await typeAndTrigger(page, '#field_item_kecamatan_ktp_id input[type="text"]', ucwords(kecamatan));
      if (!data.alamat || data.alamat.length === 0) {
        throw new Error("❌ Failed to take the patient's address");
      }
      await typeAndTrigger(page, '#field_item_alamat_ktp textarea[type="text"]', data.alamat);
    } else {
      // If the modal does not contain the expected text, we assume it's a different issue
      return {
        status: 'error',
        reason: 'data_not_found',
        description: 'Skipping due data not found'
      };
    }
  }

  const nama = await page.evaluate(() => document.querySelector('input[name="nama_peserta"]')?.value);
  data.nama = `${nama}`.trim();
  // re-check
  if (`${data.nama}`.trim().length === 0) {
    throw new Error("❌ Failed to take the patient's name");
  }

  const { gender, age, birthDate, location } = await getPersonInfo(page);
  const { province, city } = location;
  data.gender = gender;
  data.tgl_lahir = birthDate;
  data.umur = age;
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
  data.pekerjaan_original = data.pekerjaan;

  const job = data.pekerjaan.trim().toLowerCase();

  const jobMappings = [
    { pattern: /rumah\s*tangga|irt/, value: 'IRT' },
    { pattern: /swasta|pedagang/, value: 'Wiraswasta' },
    { pattern: /tukang|buruh/, value: 'Buruh ' },
    { pattern: /tidak\s*bekerja|belum\s*bekerja|pensiun/, value: 'Tidak Bekerja' },
    { pattern: /pegawai\s*negeri(\s*sipil)?|pegawai\s*negri/, value: 'PNS ' },
    { pattern: /guru|dosen/, value: 'Guru/ Dosen' },
    { pattern: /perawat|dokter/, value: 'Tenaga Profesional Medis ' },
    { pattern: /pengacara|wartawan/, value: 'Tenaga Profesional Non Medis ' },
    { pattern: /pelajar|siswa|siswi|sekolah/, value: 'Pelajar/ Mahasiswa' },
    { pattern: /s[o,u]pir/, value: 'Sopir ' }
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
    if (job === 'unspecified' || job === 'lainnya' || job.length === 0) {
      if (age > 55 || age <= 20) {
        data.pekerjaan = 'Tidak Bekerja';
      } else {
        data.pekerjaan = gender.toLowerCase() === 'perempuan' ? 'IRT' : 'Wiraswasta';
      }
    } else {
      await waitEnter(
        `Undefined Job for data: ${JSON.stringify(data)}. Please fix and press enter to continue auto fill.`
      );
    }
  }

  console.log(`Pekerjaan: ${data.pekerjaan}`);

  await typeAndTrigger(page, 'input[name="pekerjaan_id_input"]', data.pekerjaan);

  // Fix tinggi dan berat badan
  if (!data.bb || !data.tb) {
    await fixTbAndBb(page, age, gender);
  } else {
    await page.focus('#field_item_berat_badan input[type="text"]');
    await page.type('#field_item_berat_badan input[type="text"]', extractNumericWithComma(data.bb), { delay: 100 });
    await page.focus('#field_item_tinggi_badan input[type="text"]');
    await page.type('#field_item_tinggi_badan input[type="text"]', extractNumericWithComma(data.tb), { delay: 100 });
  }

  await typeAndTrigger(page, '#field_item_riwayat_kontak_tb_id input[type="text"]', 'Tidak');
  await typeAndTrigger(page, '#field_item_risiko_1_id input[type="text"]', 'Tidak');
  await typeAndTrigger(page, '#field_item_risiko_4_id input[type="text"]', 'Tidak');
  await typeAndTrigger(page, '#field_item_risiko_5_id input[type="text"]', 'Tidak');

  if (data.diabetes) {
    await typeAndTrigger(page, '#field_item_risiko_6_id input[type="text"]', 'Ya');
  } else {
    await typeAndTrigger(page, '#field_item_risiko_6_id input[type="text"]', 'Tidak');
  }

  await typeAndTrigger(page, '#field_item_risiko_7_id input[type="text"]', 'Tidak');

  if (gender.toLowerCase().trim() == 'perempuan') {
    await typeAndTrigger(page, '#field_item_risiko_9_id input[type="text"]', 'Tidak');
  }

  await typeAndTrigger(page, '#field_item_risiko_10_id input[type="text"]', 'Tidak');
  await typeAndTrigger(page, '#field_item_risiko_11_id input[type="text"]', 'Tidak');
  await typeAndTrigger(page, '#field_item_gejala_2_3_id input[type="text"]', 'Tidak');
  await typeAndTrigger(page, '#field_item_gejala_2_4_id input[type="text"]', 'Tidak');
  await typeAndTrigger(page, '#field_item_gejala_2_5_id input[type="text"]', 'Tidak');
  await typeAndTrigger(page, '#field_item_gejala_6_id input[type="text"]', 'Tidak');
  await typeAndTrigger(page, '#field_item_cxr_pemeriksaan_id input[type="text"]', 'Tidak');

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
          await typeAndTrigger(page, gejalaBalitaSelector, 'Tidak');
          await sleep(200);
        }
      }
    }
  }

  await page.keyboard.press('Tab');

  if (!data.batuk) {
    await typeAndTrigger(page, '#field_item_gejala_2_1_id input[type="text"]', 'Tidak');
  } else {
    let keteranganBatuk = data.batuk.replace(/ya,/, 'batuk');
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
    await typeAndTrigger(page, 'input[name="pekerjaan_id_input"]', data.pekerjaan);

    // Re-check
    if (await isInvalidAlertVisible(page)) {
      console.warn('⚠️ Invalid alert detected for the following data:');
      console.dir(data, { depth: null });
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
    console.log('✅\tData submitted successfully:', data);
  } else {
    console.warn('⚠️\tData processed but not submitted:', data);
    await waitEnter('Press Enter to continue...');
  }

  return {
    status: 'success',
    data
  };
}

export async function skrinLogin(page) {
  await page.goto('https://sumatera.sitb.id/sitb2024/app', { waitUntil: 'networkidle2' });
  await page.type('input[name="username"]', process.env.skrin_username);
  await page.type('input[name="password"]', process.env.skrin_password);
  await Promise.all([page.click('button[type="submit"]'), page.waitForNavigation({ waitUntil: 'networkidle2' })]);
  console.log('Login successful');
}

/**
 * Main function to automate processing of multiple rows of Excel data for skrining entry.
 *
 * Logs into the web application, iterates through the data entries, and processes each one using `processData`.
 * Optionally allows transformation of each row of data through a callback before processing.
 *
 * @param {(data: import('./globals').ExcelRowData) => import('./globals').ExcelRowData | Promise<import('./globals').ExcelRowData>} [dataCallback]
 *   A callback to optionally transform each Excel data row before processing. Can be synchronous or asynchronous.
 *   Defaults to an identity function if not provided.
 * @returns {Promise<void>} A promise that resolves when all data entries are processed and the browser is closed.
 */
export async function runEntrySkrining(dataCallback = (data) => data) {
  // const datas = getXlsxData(process.env.index_start, process.env.index_end);
  const datas = await fetchXlsxData3(process.env.index_start, process.env.index_end);
  const puppeteer = await getPuppeteer();
  let page = puppeteer.page;
  const browser = puppeteer.browser;

  await skrinLogin(page);

  while (datas.length > 0) {
    /**
     * @type {import('./globals.js').ExcelRowData}
     */
    let data = await dataCallback(datas.shift()); // <-- modify the data via callback
    const result = await processData(browser, data);
    if (result.status == 'error') {
      console.error(Object.assign(result, { data }));
      break;
    } else {
      appendLog(data);

      // Build HTML log
      await buildHtmlLog();
    }
  }

  console.log('All data processed.');
  rl.close();

  // Build HTML log
  buildHtmlLog();

  // Close browser
  await browser.close();
}

// if (process.argv[1] === __filename) runEntrySkrining().catch(console.error);
