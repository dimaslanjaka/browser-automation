import dotenv from 'dotenv';
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPuppeteer, isElementExist, isElementVisible, typeAndTrigger } from './src/puppeteer_utils.js';
import {
  fixTbAndBb,
  isNIKNotFoundModalVisible,
  isIdentityModalVisible,
  isInvalidAlertVisible,
  isNikErrorVisible,
  isSuccessNotificationVisible
} from './src/skrin_utils.js';
import { appendLog, extractNumericWithComma, getNumbersOnly, sleep } from './src/utils.js';
import { getAge, getXlsxData } from './xlsx_data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function waitEnter(message) {
  return new Promise(function (resolve) {
    rl.question(message, resolve);
  });
}

async function main() {
  const datas = getXlsxData(3012, 3036);
  const puppeteer = await getPuppeteer();
  let page = puppeteer.page;
  const browser = puppeteer.browser;

  await page.goto('https://sumatera.sitb.id/sitb2024/app', { waitUntil: 'networkidle2' });
  await page.type('input[name="username"]', process.env.skrin_username);
  await page.type('input[name="password"]', process.env.skrin_password);
  await Promise.all([page.click('button[type="submit"]'), page.waitForNavigation({ waitUntil: 'networkidle2' })]);
  console.log('Login successful');

  while (datas.length > 0) {
    page = await browser.newPage(); // Open new tab

    // Close the first tab when there are more than 2 open tabs
    const pages = await browser.pages(); // Get all open pages (tabs)
    if (pages.length > 3) {
      await pages[0].close(); // Close the first tab
    }

    await page.goto('https://sumatera.sitb.id/sitb2024/skrining', { waitUntil: 'networkidle2' });
    await page.waitForSelector('#btnAdd_ta_skrining', { visible: true });
    await page.click('#btnAdd_ta_skrining');
    await page.goto('https://sumatera.sitb.id/sitb2024/Skrining/add', { waitUntil: 'networkidle2' });

    await page.waitForSelector('#nik', { visible: true });
    await sleep(3000);

    /**
     * @type {import('./globals').ExcelRowData}
     */
    const data = datas.shift();
    if (!data) {
      throw new Error('No more data to process.');
    }

    console.log('Processing:', data);

    if (!`${data.tanggal}`.includes('/')) {
      await browser.close();
      throw new Error(`INVALID DATE ${JSON.stringify(data, null, 2)}`);
    }

    await page.$eval('#dt_tgl_skrining', (el) => el.removeAttribute('readonly'));
    await typeAndTrigger(page, '#dt_tgl_skrining', data.tanggal);
    await page.$eval('#dt_tgl_skrining', (el) => el.setAttribute('readonly', 'true'));
    await typeAndTrigger(page, 'input[name="metode_id_input"]', 'Tunggal');
    await typeAndTrigger(page, 'input[name="tempat_skrining_id_input"]', 'Puskesmas');
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
      console.error('NIK error notification visible, please re-check. Aborting...');
      break;
    }

    console.log('Identity modal is visible:', await isIdentityModalVisible(page));

    if (await isIdentityModalVisible(page)) {
      // Click the button
      await sleep(2000);

      // Get the correct iframe inside #dialog
      const iframeElement = await page.$('#dialog iframe.k-content-frame');
      if (!iframeElement) {
        throw new Error('❌ Iframe inside #dialog not found!');
      }

      // Get iframe content
      const iframe = await iframeElement.contentFrame();
      if (!iframe) {
        throw new Error('❌ Failed to get content of iframe inside #dialog!');
      }

      // Wait for the button inside the iframe
      await iframe.waitForSelector('#pilih', { timeout: 5000 });

      // Click the button inside the iframe
      await iframe.click('#pilih');

      console.log('✅ Successfully clicked the button inside the iframe.');
    }

    // Check if NIK not found modal visible
    const isNikNotFound = await isNIKNotFoundModalVisible(page);
    console.log('Is NIK not found modal visible:', isNikNotFound);

    if (isNikNotFound) {
      console.error('Skipping due data not found');
      appendLog(data, 'Skipped Data');
      // Build HTML log
      buildHtmlLog();
      continue;
    }

    const nama = await page.evaluate(() => document.querySelector('input[name="nama_peserta"]')?.value);
    data.nama = `${nama}`.trim();
    // re-check
    if (`${data.nama}`.trim().length === 0) {
      throw new Error("❌ Failed to take the patient's name");
    }

    const gender = await page.evaluate(() => document.querySelector('input[name="jenis_kelamin_id_input"]')?.value);
    data.gender = gender;
    const tgl_lahir = await page.evaluate(() => document.querySelector('input[name="dt_tgl_lahir"]')?.value);
    data.tgl_lahir = tgl_lahir;
    const age = getAge(tgl_lahir);
    data.umur = age;
    console.log('Jenis kelamin:', gender, 'Umur:', age, 'tahun');
    if (!gender || isNaN(age)) {
      throw new Error('Invalid input: Gender or age is missing/invalid.');
    }

    // Fix if location data is empty
    const provinceValue = await page.$eval('#field_item_provinsi_ktp_id input[type="text"]', (input) =>
      input.value.trim()
    );
    console.log(`Provinsi: ${provinceValue}`, provinceValue.length == 0 ? '(empty)' : '');
    if (provinceValue.length == 0) {
      await typeAndTrigger(page, '#field_item_provinsi_ktp_id input[type="text"]', 'Jawa Timur');
    }

    const cityValue = await page.$eval('#field_item_kabupaten_ktp_id input[type="text"]', (input) =>
      input.value.trim()
    );
    console.log(`Kabupaten/Kota: ${cityValue}`, cityValue.length == 0 ? '(empty)' : '');
    if (cityValue.length == 0) {
      await typeAndTrigger(page, '#field_item_kabupaten_ktp_id input[type="text"]', 'Kota Surabaya');
    }

    // Fix job
    data.pekerjaan_original = data.pekerjaan;

    const job = data.pekerjaan.trim().toLowerCase();

    const jobMappings = [
      { pattern: /pelajar|mahasiswa/, value: 'Pelajar/ Mahasiswa' },
      { pattern: /rumah\s*tangga/, value: 'IRT' },
      { pattern: /swasta|pedagang/, value: 'Wiraswasta' },
      { pattern: /tukang|buruh/, value: 'Buruh ' },
      { pattern: /tidak\s*bekerja|belum\s*bekerja|pensiun/, value: 'Tidak Bekerja' },
      { pattern: /pegawai\s*negeri(\s*sipil)?|pegawai\s*negri/, value: 'PNS ' },
      { pattern: /guru|dosen/, value: 'Guru/ Dosen' },
      { pattern: /perawat/, value: 'Tenaga Profesional Medis ' }
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
      if (job === 'unspecified') {
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
      await typeAndTrigger(page, '#field_item_keterangan textarea', keteranganBatuk);
      await waitEnter('Please fix data batuk/demam. Press Enter to continue...');
    }

    await sleep(2000);

    // Re-check if the identity modal is visible
    while (await isIdentityModalVisible(page)) {
      await waitEnter('Please check identity modal. Press Enter to continue...');
    }

    // Check if the invalid element alert is visible
    while (await isInvalidAlertVisible(page)) {
      await waitEnter('Please check alert messages. Press Enter to continue...');
    }

    // Auto submit
    let hasSubmitted = false;
    if (
      !(await isIdentityModalVisible(page)) &&
      !(await isInvalidAlertVisible(page)) &&
      !(await isNikErrorVisible(page)) &&
      !(await isNIKNotFoundModalVisible(page))
    ) {
      // Click save
      await page.click('#save');
      try {
        // Wait for the confirmation modal to appear
        await page.waitForSelector('#yesButton', { visible: true });
        // Click the "Ya" button
        await page.click('#yesButton');
      } catch (_) {
        // Fail sending data, press manually
      }

      await sleep(1000); // waiting ajax
      while (!(await isSuccessNotificationVisible(page))) {
        await waitEnter('Success notification not visible. Press Enter to continue...');
      }

      hasSubmitted = true;
    }

    console.log('Data processed successfully:', data);
    if (!hasSubmitted) await waitEnter('Press Enter to continue...');
    appendLog(data);

    // Build HTML log
    buildHtmlLog();
  }

  console.log('All data processed.');
  rl.close();

  // Build HTML log
  buildHtmlLog();

  // Close browser
  await browser.close();
}

function buildHtmlLog() {
  spawn('node', [path.resolve(__dirname, 'log-builder.js')], { cwd: __dirname });
}

main().catch(console.error);
