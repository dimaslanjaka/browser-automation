import moment from 'moment';
import type { NikParseResult } from 'nik-parser-jurusid';
import * as nikUtils from 'nik-parser-jurusid/index';
import type { Browser, Page } from 'puppeteer';
import { isEmpty } from 'sbg-utility';
import type { ExcelRowData, fixDataResult } from '../../../globals.js';
import { getStreetAddressInformation } from '../../address/index.js';
import type { LogDatabase } from '../../database/LogDatabase.js';
import { MysqlLogDatabase } from '../../database/MysqlLogDatabase.js';
import { SQLiteLogDatabase } from '../../database/SQLiteLogDatabase.js';
import { isElementExist, isElementVisible, typeAndTrigger } from '../../puppeteer_utils.js';
import { autoLoginAndEnterSkriningPage } from '../../skrin_puppeteer.js';
import {
  confirmIdentityModal,
  getNormalizedFormValues,
  getPersonInfo,
  isIdentityModalVisible,
  isInvalidAlertVisible,
  isNikErrorVisible,
  isNIKNotFoundModalVisible,
  isSessionExpiredAlertVisible,
  isSuccessNotificationVisible
} from '../../skrin_utils.js';
import { extractNumericWithComma, getNumbersOnly, sleep, waitEnter } from '../../utils.js';
import { ucwords } from '../../utils/string.js';
import { fixData } from '../../xlsx-helper.js';
import FileLockHelper from '../../utils/FileLockHelper.js';
import path from 'path';

export type ProcessDataResult =
  | { status: 'success'; data: fixDataResult }
  | { status: 'error'; reason?: 'invalid_nik_length' | 'data_not_found' | string; description?: string };

type NormalizedFormValue = Awaited<ReturnType<typeof getNormalizedFormValues>>[number];

/**
 * Re-evaluates the form by re-typing the "metode_id_input" field to trigger any dynamic changes on the page.
 *
 * This function is used to ensure that any dependent fields or validations that rely on the "metode_id_input" value are properly updated after changes to the form.
 *
 * @async
 * @param page Puppeteer page instance.
 */
async function reEvaluate(page: Page): Promise<void> {
  await typeAndTrigger(page, 'input[name="metode_id_input"]', 'Tunggal');
}

/**
 * Processes a single row of Excel data by automating the form-filling process on the skrining site.
 *
 * Steps include navigating pages, inputting data, checking for various modals and alerts,
 * correcting job/location fields, and submitting the form.
 *
 * @param page Puppeteer page or browser instance used to interact with the skrining form.
 *   When a browser instance is provided, the first available page is used, or a new page is created.
 * @param data A single row of Excel data to be submitted through the form.
 * @param database Database instance used for reading/writing logs.
 * @returns Result of the processing. On success, status is 'success' with the processed data. On failure, status is 'error' with reason and description.
 * @throws {Error} If required fields are missing or an unexpected state is encountered.
 */
export async function processData(
  page: Page | Browser,
  data: ExcelRowData,
  database: LogDatabase | MysqlLogDatabase | SQLiteLogDatabase
): Promise<ProcessDataResult> {
  if ('pages' in page) {
    const pages = await page.pages();
    page = pages[0] || (await page.newPage());
  }
  page.setDefaultTimeout(0);
  page.setDefaultNavigationTimeout(0);

  // Note: keep login early to ensure session available for locking checks/UI interactions.
  await autoLoginAndEnterSkriningPage(page);
  await page.waitForSelector('#nik', { visible: true });
  await sleep(3000);

  if (!data) {
    throw new Error('No more data to process.');
  }

  const NIK = data.nik;
  if (!nikUtils.isValidNIK(NIK)) {
    await database.addLog({
      id: getNumbersOnly(NIK),
      data: { ...data, status: 'invalid' },
      message: 'Invalid NIK format'
    });
    console.error(`Skipping due to invalid NIK format: ${NIK}`);
    return {
      status: 'error',
      reason: 'invalid_nik_format',
      description: `Skipping due to invalid NIK format: ${NIK}`
    };
  }

  // skip logic removed: locking handled externally

  const existing = await database.getLogById(getNumbersOnly(NIK));
  if (existing && existing.data) {
    console.log(`Data with NIK ${NIK} has already been processed. Skipping...`);
    return {
      status: 'error',
      reason: 'duplicate_entry',
      description: `Data with NIK ${NIK} has already been processed.`
    };
  }

  // Fix and normalize data before processing
  const fixedData = await fixData(data, { autofillTanggalEntry: true, fixNamaBayi: true });
  const parsedNik: NikParseResult = fixedData.parsed_nik || (await nikUtils.nikParse(fixedData.nik));

  // Acquire an exclusive lock for this NIK+NAMA to prevent concurrent processing.
  const rawName = (fixedData.nama || fixedData.NAMA || data.nama || '').toString();
  const sanitizeName = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60);
  const lockFileName = `${getNumbersOnly(NIK)}_${sanitizeName(rawName)}.lock`;
  const lockFilePath = path.join(process.cwd(), 'tmp', 'locks', lockFileName);
  const locker = new FileLockHelper(lockFilePath);
  if (!locker.lock()) {
    await database.addLog({
      id: getNumbersOnly(NIK),
      data: { ...fixedData, status: 'locked' },
      message: 'Skipped: locked by another process'
    });
    console.warn(`Skipping NIK ${NIK} — locked by another process (lock=${lockFilePath})`);
    return {
      status: 'error',
      reason: 'in_progress',
      description: `Another process is handling this NIK/NAMA (lock=${lockFilePath})`
    };
  }

  try {
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
      await waitEnter('Please check NIK error notification. Press Enter to continue...');
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

        const text = ((dialog as any).innerText || dialog.textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
        const clickYesTriggers = [
          'access to resources is temporary closed',
          'the daily quota has reached the maximum limit',
          'data tidak ditemukan'
        ];

        return clickYesTriggers.some((trigger) => text.includes(trigger));
      });

      console.log('Should click Yes on NIK not found modal:', shouldClickYes);

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

        let kabupatenOrKota = '',
          kecamatan = '',
          provinsi = '',
          kelurahan = '';

        const keywordAddr = `${fixedData.alamat} Surabaya, Jawa Timur`.trim();
        const geocodedAddress = await getStreetAddressInformation(keywordAddr);

        if (geocodedAddress) {
          fixedData._address = geocodedAddress.raw || geocodedAddress;
          console.log(`Fetching address from geocoder for: ${keywordAddr}`);
          console.log('Geocoder result:', geocodedAddress);

          kelurahan = geocodedAddress.kelurahan || '';
          kecamatan = geocodedAddress.kecamatan || '';
          kabupatenOrKota = geocodedAddress.kabupaten || geocodedAddress.kota || '';
          provinsi = geocodedAddress.provinsi || '';

          if (kabupatenOrKota.toLowerCase().includes('surabaya')) {
            kabupatenOrKota = 'Kota Surabaya';
          }
        }

        // Fallback to parsed NIK only for missing fields
        if ((isEmpty(kabupatenOrKota) || isEmpty(kecamatan) || isEmpty(provinsi) || isEmpty(kelurahan)) && parsedNik) {
          const _parsedNikData =
            parsedNik && parsedNik.status === 'success' ? parsedNik.data : ({} as nikUtils.NikParseSuccess['data']);
          if (isEmpty(kabupatenOrKota)) {
            kabupatenOrKota = _parsedNikData.kotakab || '';
          }
          if (isEmpty(kecamatan)) {
            kecamatan = (_parsedNikData as any).kecamatan || _parsedNikData.namaKec || '';
          }
          if (isEmpty(provinsi)) {
            provinsi = _parsedNikData.provinsi || '';
          }

          if (isEmpty(kelurahan)) {
            const parsedKelurahan = _parsedNikData.kelurahan != null ? _parsedNikData.kelurahan : null;
            const selectedKelurahan = Array.isArray(parsedKelurahan)
              ? parsedKelurahan.length > 0
                ? parsedKelurahan[0]
                : null
              : parsedKelurahan || null;
            kelurahan = selectedKelurahan
              ? typeof selectedKelurahan === 'object' && 'name' in selectedKelurahan
                ? String(selectedKelurahan.name || '')
                : String(selectedKelurahan)
              : '';
          }

          console.log(
            `Using parsed NIK fallback for address: ${kelurahan || '<unknown kelurahan>'}, ${
              kecamatan || '<unknown kec>'
            }, ${kabupatenOrKota || '<unknown kota>'}, ${provinsi || '<unknown provinsi>'}`
          );
        }

        if (!geocodedAddress && (!parsedNik || parsedNik.status !== 'success')) {
          throw new Error(
            `❌ Failed to determine address: no geocoder result and no parsed NIK data available (nik=${fixedData.nik || '<unknown>'}, alamat=${fixedData.alamat || '<unknown>'})`
          );
        }

        if (typeof kelurahan !== 'string' || isEmpty(kelurahan)) {
          console.log({ provinsi, kotakab: kabupatenOrKota, kecamatan, kelurahan });
          throw new Error('kelurahan should be string');
        }

        // Ensure provinsi, kotakab, kecamatan, kelurahan not empty — throw descriptive error
        if (isEmpty(provinsi) || isEmpty(kabupatenOrKota) || isEmpty(kecamatan) || isEmpty(kelurahan)) {
          throw new Error(
            `Missing required address fields: provinsi='${provinsi || ''}', kotakab='${kabupatenOrKota || ''}', kecamatan='${kecamatan || ''}', kelurahan='${kelurahan || ''}'`
          );
        } else {
          console.log(`Inputting address ${provinsi} -> ${kabupatenOrKota} -> ${kecamatan} -> ${kelurahan}`);
        }

        // Input provinsi -> kabupaten -> kecamatan -> kelurahan -> alamat
        await typeAndTrigger(page, '#field_item_provinsi_ktp_id input[type="text"]', ucwords(provinsi));
        await typeAndTrigger(page, '#field_item_kabupaten_ktp_id input[type="text"]', ucwords(kabupatenOrKota));
        await typeAndTrigger(page, '#field_item_kecamatan_ktp_id input[type="text"]', ucwords(kecamatan));
        await typeAndTrigger(page, '#field_item_kelurahan_ktp_id input[type="text"]', ucwords(kelurahan));
        await typeAndTrigger(page, '#field_item_alamat_ktp textarea[type="text"]', fixedData.alamat);
      } else {
        return {
          status: 'error',
          reason: 'data_not_found',
          description: 'Skipping due data not found'
        };
      }
    }

    // Get the patient's name from the form after confirming identity (or if no modal appeared)
    const nama = await page.evaluate(
      () => (document.querySelector('input[name="nama_peserta"]') as HTMLInputElement)?.value
    );
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
    fixedData.pekerjaan_original = data.pekerjaan || '<empty>';
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
      const keteranganBatuk = fixedData.batuk.replace(/ya,/, 'batuk');
      if (/\d/m.test(keteranganBatuk)) {
        await typeAndTrigger(page, '#field_item_keterangan textarea', keteranganBatuk);
        await waitEnter('Please fix data batuk/demam. Press Enter to continue...');
      } else {
        // clear keterangan if no numeric info is present to avoid invalid alert
        await typeAndTrigger(page, '#field_item_keterangan textarea', '');
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
    let hasSubmitted = false;
    const identityModalVisible = await isIdentityModalVisible(page);
    const invalidAlertVisible = await isInvalidAlertVisible(page);
    const nikErrorVisible = await isNikErrorVisible(page);
    const nikNotFoundModalVisible = await isNIKNotFoundModalVisible(page);
    const sessionExpiredAlertVisible = await isSessionExpiredAlertVisible(page);
    const isAllowedToSubmit =
      !identityModalVisible &&
      !invalidAlertVisible &&
      !nikErrorVisible &&
      !nikNotFoundModalVisible &&
      !sessionExpiredAlertVisible;
    console.log(
      `Submission eligibility check: identityModalVisible=${identityModalVisible}, invalidAlertVisible=${invalidAlertVisible}, nikErrorVisible=${nikErrorVisible}, nikNotFoundModalVisible=${nikNotFoundModalVisible}, sessionExpiredAlertVisible=${sessionExpiredAlertVisible}, isAllowedToSubmit=${isAllowedToSubmit}`
    );

    // Re-login if session expired
    if (sessionExpiredAlertVisible) {
      console.warn('⚠️ Session expired alert detected. Attempting to re-login...');
      await waitEnter('Session expired. Please log in again, then press Enter to continue...');
      await autoLoginAndEnterSkriningPage(page);
      // After re-login, we should ideally re-fill the form with the same data before submitting
      // For simplicity, we will just return an error here and let the user re-run the process for this entry
      return {
        status: 'error',
        reason: 'session_expired',
        description:
          'Session expired during processing. Please re-run the process for this entry after logging in again.'
      };
    }

    if (isAllowedToSubmit) {
      // get form values before submission
      console.log(`Getting form values for NIK: ${NIK} before submission...`);
      const formValues: NormalizedFormValue[] = await getNormalizedFormValues(page);
      fixedData.formValues = formValues;

      console.log(`Form values for NIK: ${NIK} (${formValues.length} items)`);
      for (const [index, formValue] of formValues.entries()) {
        console.log(`Form value #${index + 1} for NIK ${NIK}:`, formValue);
      }

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
        await waitEnter(
          'Failed to click #yesButton for confirmation modal. Please click the button manually, then press Enter to continue...'
        );
      }

      await sleep(1000);
      const waitStart = Date.now();
      while (true) {
        const isSuccessVisible = await isSuccessNotificationVisible(page);
        if (isSuccessVisible) {
          console.log('✅ Success notification is visible');
          break;
        }
        const elapsedSeconds = Math.floor((Date.now() - waitStart) / 1000);
        if (elapsedSeconds >= 300) {
          process.stdout.write('\n');
          process.stderr.write(`❌ Timed out waiting for success notification after ${elapsedSeconds} seconds.\n`);
          return {
            status: 'error',
            reason: 'success_notification_timeout',
            description: 'Timed out waiting for success notification after 5 minutes.'
          };
        }
        // Optional: wait a bit to avoid tight loop
        await new Promise((r) => setTimeout(r, 1000));
        process.stdout.write(`\rWaiting for success notification modal to be visible... ${elapsedSeconds}s elapsed`);
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

    // Get form values after submission (to capture any changes triggered by submission)
    console.log(`Getting form values for NIK: ${NIK} after submission...`);
    const afterSubmitFormValues = await getNormalizedFormValues(page);
    fixedData.formValues = afterSubmitFormValues;

    await database.addLog({
      id: getNumbersOnly(NIK),
      data: { ...fixedData, status: 'success' },
      message: `Data for NIK: ${NIK} submitted successfully.`
    });
    return {
      status: 'success',
      data: fixedData
    };
  } finally {
    try {
      locker.unlock();
    } catch (_err) {
      void _err;
    }
  }
}
