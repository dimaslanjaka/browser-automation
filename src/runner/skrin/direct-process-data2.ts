import moment from 'moment';
import type { NikParseResult } from 'nik-parser-jurusid';
import * as nikUtils from 'nik-parser-jurusid/index';
import path from 'path';
import type { Browser, Page } from 'puppeteer';
import { isEmpty } from 'sbg-utility';
import type { ExcelRowData, fixDataResult } from '../../../globals.js';
import { getStreetAddressInformation } from '../../address/index.js';
import type { LogDatabase } from '../../database/LogDatabase.js';
import { MysqlLogDatabase } from '../../database/MysqlLogDatabase.js';
import { SQLiteLogDatabase } from '../../database/SQLiteLogDatabase.js';
import { isElementExist, isElementVisible, typeAndTrigger, waitForDomStable } from '../../puppeteer_utils.js';
import { autoLoginAndEnterSkriningPage } from '../../skrin_puppeteer.js';
import { extractNumericWithComma, getNumbersOnly, sleep, waitEnter } from '../../utils/index.js';
import FileLockHelper from '../../utils/FileLockHelper.js';
import { findInArray, ucwords } from '../../utils/string.js';
import { fixData } from '../../xlsx-helper.js';
import { confirmIdentityModal } from './confirmIdentityModal.js';
import { selectDateWithUI, setDatepickerValue } from './datePicker.js';
import { getNormalizedFormValues } from './getNormalizedFormValues.js';
import { getPersonInfo } from './getPersonInfo.js';
import { isIdentityModalVisible } from './isIdentityModalVisible.js';
import { isInvalidAlertVisible } from './isInvalidAlertVisible.js';
import { isNikErrorVisible } from './isNikErrorVisible.js';
import { isNIKNotFoundModalVisible } from './isNIKNotFoundModalVisible.js';
import { isSessionExpiredAlertVisible } from './isSessionExpiredAlertVisible.js';
import { isSuccessNotificationVisible } from './isSuccessNotificationVisible.js';

export type ProcessDataResult =
  | { status: 'success'; data: fixDataResult }
  | { status: 'error'; reason?: 'invalid_nik_length' | 'data_not_found' | string; description?: string };

type NormalizedFormValue = Awaited<ReturnType<typeof getNormalizedFormValues>>[number];

/**
 * Waits up to 5 minutes for the success notification to appear.
 * Returns true if visible within the timeout, false otherwise.
 */
async function waitForSuccessNotification(page: Page): Promise<boolean> {
  const waitStart = Date.now();
  while (true) {
    if (await isSuccessNotificationVisible(page)) {
      console.log('✅ Success notification is visible');
      return true;
    }
    const elapsedSeconds = Math.floor((Date.now() - waitStart) / 1000);
    if (elapsedSeconds >= 300) {
      process.stdout.write('\n');
      process.stderr.write(`❌ Timed out waiting for success notification after ${elapsedSeconds} seconds.\n`);
      return false;
    }
    await new Promise((r) => setTimeout(r, 1000));
    process.stdout.write(`\rWaiting for success notification modal to be visible... ${elapsedSeconds}s elapsed`);
  }
}

/**
 * Resolves a patient's address via geocoding (with parsed-NIK fallback), validates all
 * required components, then types them into the KTP address fields on the form.
 *
 * Mutates `fixedData._address` with the raw geocoder result when available.
 *
 * @param page Puppeteer page instance.
 * @param fixedData The fixed/normalized row data (mutated to store `_address`).
 * @param parsedNik Parsed NIK result used as fallback when geocoding is incomplete.
 * @throws If address components cannot be resolved or required fields remain empty.
 */
async function resolveAndFillAddress(
  page: Page,
  fixedData: Awaited<ReturnType<typeof fixData>>,
  parsedNik: NikParseResult
): Promise<void> {
  if (!fixedData.alamat || fixedData.alamat.length === 0) {
    throw new Error("❌ Failed to take the patient's address");
  }

  let provinsi = '',
    kabupatenOrKota = '',
    kecamatan = '',
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

  // Fallback to parsed NIK for any missing components
  if ((isEmpty(provinsi) || isEmpty(kabupatenOrKota) || isEmpty(kecamatan) || isEmpty(kelurahan)) && parsedNik) {
    const _parsedNikData = parsedNik.status === 'success' ? parsedNik.data : ({} as nikUtils.NikParseSuccess['data']);

    if (isEmpty(kabupatenOrKota)) kabupatenOrKota = _parsedNikData.kotakab || '';
    if (isEmpty(kecamatan)) kecamatan = (_parsedNikData as any).kecamatan || _parsedNikData.namaKec || '';
    if (isEmpty(provinsi)) provinsi = _parsedNikData.provinsi || '';

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
      `Using parsed NIK fallback for address: ${kelurahan || '<unknown kelurahan>'}, ` +
        `${kecamatan || '<unknown kec>'}, ${kabupatenOrKota || '<unknown kota>'}, ${provinsi || '<unknown provinsi>'}`
    );
  }

  if (!geocodedAddress && (!parsedNik || parsedNik.status !== 'success')) {
    throw new Error(
      `❌ Failed to determine address: no geocoder result and no parsed NIK data available ` +
        `(nik=${fixedData.nik || '<unknown>'}, alamat=${fixedData.alamat || '<unknown>'})`
    );
  }

  if (typeof kelurahan !== 'string' || isEmpty(kelurahan)) {
    console.log({ provinsi, kotakab: kabupatenOrKota, kecamatan, kelurahan });
    throw new Error('kelurahan should be string');
  }

  if (isEmpty(provinsi) || isEmpty(kabupatenOrKota) || isEmpty(kecamatan) || isEmpty(kelurahan)) {
    throw new Error(
      `Missing required address fields: provinsi='${provinsi}', kotakab='${kabupatenOrKota}', ` +
        `kecamatan='${kecamatan}', kelurahan='${kelurahan}'`
    );
  }

  console.log(`Inputting address ${provinsi} -> ${kabupatenOrKota} -> ${kecamatan} -> ${kelurahan}`);

  for (const [selector, value] of [
    ['#field_item_provinsi_ktp_id input[type="text"]', ucwords(provinsi)],
    ['#field_item_kabupaten_ktp_id input[type="text"]', ucwords(kabupatenOrKota)],
    ['#field_item_kecamatan_ktp_id input[type="text"]', ucwords(kecamatan)],
    ['#field_item_kelurahan_ktp_id input[type="text"]', ucwords(kelurahan)],
    ['#field_item_alamat_ktp textarea', fixedData.alamat]
  ] as const) {
    await page.waitForSelector(selector, { visible: true });
    await page.type(selector, value, { delay: 100 });

    // wait for dropdown to appear (important)
    await sleep(300);

    // move to first suggestion
    await page.keyboard.press('ArrowDown');

    // select it
    await page.keyboard.press('Enter');

    await sleep(200);
  }

  const invalidAlert = await isInvalidAlertVisible(page);
  if (invalidAlert.result) {
    const findAddressError = findInArray(invalidAlert.contents, /kabupaten/i);
    if (findAddressError.length > 0) {
      console.log({ provinsi, kotakab: kabupatenOrKota, kecamatan, kelurahan });
      throw new Error(`Address validation error: ${findAddressError.join('; ')}`);
    }
  }
}

/**
 * Fills province and city fields with default Surabaya values if they are empty on the form.
 * Called after identity confirmation to guard against blank location data.
 *
 * @param page Puppeteer page instance.
 * @param province Current province value read from the page.
 * @param city Current city value read from the page.
 */
async function fillFallbackLocationIfEmpty(page: Page, province: string, city: string): Promise<void> {
  console.log(`Provinsi: ${province}`, province.length === 0 ? '(empty)' : '');
  if (province.length === 0) {
    await typeAndTrigger(page, '#field_item_provinsi_ktp_id input[type="text"]', 'Jawa Timur');
  }

  console.log(`Kabupaten/Kota: ${city}`, city.length === 0 ? '(empty)' : '');
  if (city.length === 0) {
    await typeAndTrigger(page, '#field_item_kabupaten_ktp_id input[type="text"]', 'Kota Surabaya');
  }
}

/**
 * Fills all "Tidak" (No) fields in the skrining form, including gender-specific,
 * age-specific (balita), diabetes, batuk, and CXR fields.
 *
 * @param page Puppeteer page instance.
 * @param ctx Context derived from the patient record and page state.
 */
async function fillAllTidakFields(
  page: Page,
  ctx: { gender: string; age: number; hasDiabetes: boolean; hasBatuk: boolean }
): Promise<void> {
  // Always-Tidak fields
  const alwaysTidakSelectors = [
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
    '#field_item_gejala_6_id input[type="text"]'
  ];

  // Gender-specific: risiko kehamilan only applies to perempuan
  if (ctx.gender.toLowerCase().trim() === 'perempuan') {
    alwaysTidakSelectors.push('#field_item_risiko_9_id input[type="text"]');
  }

  for (const selector of alwaysTidakSelectors) {
    await typeAndTrigger(page, selector, 'Tidak');
  }

  // Diabetes: Ya or Tidak
  await typeAndTrigger(page, '#field_item_risiko_6_id input[type="text"]', ctx.hasDiabetes ? 'Ya' : 'Tidak');

  // Age-specific: gejala balita fields are conditionally rendered
  if (ctx.age < 18) {
    console.log('Filling balita-specific fields with "Tidak" since age is under 18');
    const gejalaBalitaSelectors = [
      '#field_item_gejala_1_1_id input[type="text"]',
      '#field_item_gejala_1_3_id input[type="text"]',
      '#form_item_gejala_1_4_id input[type="text"]',
      '#field_item_gejala_1_5_id input[type="text"]'
    ];

    for (const selector of gejalaBalitaSelectors) {
      if (await isElementExist(page, selector)) {
        const visible = await isElementVisible(page, selector);
        console.log(`${selector} is visible: ${visible}`);
        if (visible) {
          await typeAndTrigger(page, selector, 'Tidak');
          await sleep(200);
        }
      }
    }
  }

  await page.keyboard.press('Tab');

  // Batuk: Tidak if no cough, otherwise handled by caller via keterangan
  if (!ctx.hasBatuk) {
    await typeAndTrigger(page, '#field_item_gejala_2_1_id input[type="text"]', 'Tidak');
  }

  // CXR: always Tidak
  for (const selector of ['#form_item_cxr_pemeriksaan_id input', '#form_item_cxr_alasan textarea']) {
    await typeAndTrigger(page, selector, 'Tidak');
  }
}

/**
 * Processes a single row of Excel data by automating the form-filling process on the skrining site.
 *
 * Steps include navigating pages, inputting data, checking for modals and alerts,
 * correcting job/location fields, and submitting the form.
 *
 * @async
 * @param page Puppeteer `Page` or `Browser`. If a `Browser` is provided, the first available page is used or a new page is created.
 * @param data Single row of Excel data to submit.
 * @param database Database instance used for reading and writing logs.
 * @param options Optional settings that modify validation behavior — `skipValidateDb` (default false), `skipCurrentMonthValidation`, `skipCurrentYearValidation`.
 * @returns Result of processing: on success returns status 'success' with processed data; on error returns status 'error' with reason and description.
 * @throws If required fields are missing or an unexpected state is encountered.
 */
export async function processData(
  page: Page | Browser | null | undefined,
  data: ExcelRowData,
  database: LogDatabase | MysqlLogDatabase | SQLiteLogDatabase,
  options: { skipValidateDb?: boolean; skipCurrentMonthValidation?: boolean; skipCurrentYearValidation?: boolean } = {
    skipValidateDb: false
  }
): Promise<ProcessDataResult> {
  if (!page) {
    throw new Error('Puppeteer page instance is required');
  }
  if ('pages' in page) {
    const pages = await page.pages();
    page = pages[0] || (await page.newPage());
  }
  page.setDefaultTimeout(0);
  page.setDefaultNavigationTimeout(0);

  // Note: keep login early to ensure session available for locking checks/UI interactions.
  await autoLoginAndEnterSkriningPage(page);
  await waitForDomStable(page, 3000, 60000);
  await page.waitForSelector('#nik', { visible: true });

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

  if (!options?.skipValidateDb) {
    const existing = await database.getLogById(getNumbersOnly(NIK));
    if (existing && existing.data) {
      console.log(`Data with NIK ${NIK} has already been processed. Skipping...`);
      return {
        status: 'error',
        reason: 'duplicate_entry',
        description: `Data with NIK ${NIK} has already been processed.`
      };
    }
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

    // Always validate the date format to ensure it's in DD/MM/YYYY format, which is required by the form.
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

    // Always validate the parsed date to ensure it's a valid calendar date.
    if (!parseTanggal.isValid()) {
      throw new Error(
        `INVALID DATE (parse failed): tanggal=${String(tanggalEntry)} (type=${typeof tanggalEntry}) - data=${JSON.stringify(
          fixedData,
          null,
          2
        )}`
      );
    }

    // Disallow Sunday dates as the system does not accept them.
    if (parseTanggal.day() === 0) {
      throw new Error(`SUNDAY DATE NOT ALLOWED: ${tanggalEntry}`);
    }

    const today = moment();

    if (options?.skipCurrentYearValidation) {
      console.warn('skipCurrentYearValidation enabled — skipping current year validation for', tanggalEntry);
    } else if (parseTanggal.year() !== today.year()) {
      throw new Error(
        `YEAR NOT ALLOWED: tanggal=${String(tanggalEntry)} (type=${typeof tanggalEntry}) - data=${JSON.stringify(
          fixedData,
          null,
          2
        )}`
      );
    }

    if (options?.skipCurrentMonthValidation) {
      console.warn('skipCurrentMonthValidation enabled — skipping current month validation for', tanggalEntry);
    } else if (parseTanggal.month() !== today.month()) {
      throw new Error(
        `MONTH NOT ALLOWED: tanggal=${String(tanggalEntry)} (type=${typeof tanggalEntry}) - data=${JSON.stringify(
          fixedData,
          null,
          2
        )}`
      );
    }

    try {
      await setDatepickerValue(page, tanggalEntry);
      await selectDateWithUI(page, tanggalEntry, { skipMonthNavigation: true });
    } catch (error) {
      const description = error instanceof Error ? error.message : String(error);
      console.error('Failed to set or select tanggal entry date:', description);
      return {
        status: 'error',
        reason: 'datepicker_error',
        description: `Failed to set or select tanggal entry date: ${description}`
      };
    }

    await typeAndTrigger(page, 'input[name="tempat_skrining_id_input"]', 'Puskesmas');
    await typeAndTrigger(page, '#nik', getNumbersOnly(NIK));
    await waitForDomStable(page, 5000, 60000);

    // Check if the ID modal appears
    try {
      await page.waitForSelector('.k-widget.k-window.k-window-maximized', { timeout: 5000 });
    } catch (_e) {
      //
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

        const parsedLahir = moment(fixedData.tgl_lahir, ['DD/MM/YYYY', 'YYYY-MM-DD'], true);
        if (!parsedLahir.isValid()) {
          throw new Error(`❌ Invalid birth date format from NIK, expected DD/MM/YYYY, got: ${fixedData.tgl_lahir}`);
        }

        await typeAndTrigger(page, '#field_item_tgl_lahir input[type="text"]', parsedLahir.format('DD/MM/YYYY'));

        await resolveAndFillAddress(page, fixedData, parsedNik);
      } else {
        return {
          status: 'error',
          reason: 'data_not_found',
          description: 'Skipping due data not found'
        };
      }
    }

    // Get the patient's name from the form after confirming identity (or if no modal appeared)
    let nama = await page.evaluate(
      () => (document.querySelector('input[name="nama_peserta"]') as HTMLInputElement)?.value
    );
    fixedData.nama_from_page = `${nama}`.trim();
    if (isEmpty(`${fixedData.nama_from_page}`)) {
      const NAMA = fixedData.nama || fixedData.NAMA || '';
      if (!NAMA || NAMA.length === 0) {
        throw new Error("❌ Failed to take the patient's name");
      }
      nama = await page.evaluate(
        () => (document.querySelector('input[name="nama_peserta"]') as HTMLInputElement)?.value
      );
      fixedData.nama_from_page = `${nama}`.trim();
      await typeAndTrigger(page, '#field_item_nama_peserta input[type="text"]', NAMA);
    }

    if (isEmpty(`${fixedData.nama_from_page}`)) {
      throw new Error("❌ Patient's name is empty after confirmation");
    }

    const { gender, age, birthDate, location } = await getPersonInfo(page);
    const { province, city } = location;
    fixedData.gender_from_page = gender;
    fixedData.tgl_lahir_from_page = birthDate;
    fixedData.umur_from_page = age;
    console.log('Jenis kelamin:', gender, 'Umur:', age, 'tahun');
    if (!gender || !Number.isFinite(age)) {
      throw new Error('Invalid input: Gender or age is missing/invalid.');
    }

    await fillFallbackLocationIfEmpty(page, province, city);

    fixedData.pekerjaan_original = data.pekerjaan || '<empty>';
    console.log(`Pekerjaan: ${fixedData.pekerjaan}`);
    await typeAndTrigger(page, 'input[name="pekerjaan_id_input"]', fixedData.pekerjaan);

    const bb = fixedData.bb || fixedData.BB || null;
    const tb = fixedData.tb || fixedData.TB || null;
    console.log(`Inputting berat badan (${bb}) dan tinggi badan (${tb}) untuk NIK: ${NIK}`);

    await page.focus('#field_item_berat_badan input[type="text"]');
    await page.type('#field_item_berat_badan input[type="text"]', extractNumericWithComma(bb), { delay: 100 });
    await page.focus('#field_item_tinggi_badan input[type="text"]');
    await page.type('#field_item_tinggi_badan input[type="text"]', extractNumericWithComma(tb), { delay: 100 });

    await fillAllTidakFields(page, { gender, age, hasDiabetes: !!fixedData.diabetes, hasBatuk: !!fixedData.batuk });

    // Batuk keterangan: only needed when batuk is present (hasBatuk=false is already handled inside fillAllTidakFields)
    if (fixedData.batuk) {
      const keteranganBatuk = fixedData.batuk.replace(/ya,/, 'batuk');
      if (/\d/m.test(keteranganBatuk)) {
        await typeAndTrigger(page, '#field_item_keterangan textarea', keteranganBatuk);
        await waitEnter('Please fix data batuk/demam. Press Enter to continue...');
      } else {
        await typeAndTrigger(page, '#field_item_keterangan textarea', '');
      }
    }

    await sleep(2000);

    // Re-check if the identity modal is visible
    while (await isIdentityModalVisible(page)) {
      await confirmIdentityModal(page);
      await sleep(1000);
      if (await isIdentityModalVisible(page)) {
        await waitEnter('Please check identity modal. Press Enter to continue...');
      }
    }

    // Resolve invalid alert — retry common fixes then wait for manual intervention
    let invalidAlert = await isInvalidAlertVisible(page);
    while (invalidAlert.result) {
      await typeAndTrigger(page, 'input[name="tempat_skrining_id_input"]', 'Puskesmas');
      await typeAndTrigger(page, 'input[name="pekerjaan_id_input"]', fixedData.pekerjaan);
      invalidAlert = await isInvalidAlertVisible(page);
      if (invalidAlert.result) {
        console.dir(fixedData, { depth: null });
        console.warn('⚠️ Invalid alert detected for the following data:');
        console.warn(`  ${invalidAlert.contents.join(' - ')}`);
        await waitEnter('Please review the alert and press Enter to continue...');
      }
    }

    // Pre-submission eligibility check
    const identityModalVisible = await isIdentityModalVisible(page);
    const invalidAlertState = await isInvalidAlertVisible(page);
    const invalidAlertVisible = invalidAlertState.result;
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
    if (invalidAlertState.contents.length > 0) {
      console.log(`Invalid alert contents: ${invalidAlertState.contents.join(' | ')}`);
    }

    if (sessionExpiredAlertVisible) {
      console.warn('⚠️ Session expired alert detected. Attempting to re-login...');
      await waitEnter('Session expired. Please log in again, then press Enter to continue...');
      await autoLoginAndEnterSkriningPage(page);
      return {
        status: 'error',
        reason: 'session_expired',
        description:
          'Session expired during processing. Please re-run the process for this entry after logging in again.'
      };
    }

    if (isAllowedToSubmit) {
      console.log(`Getting form values for NIK: ${NIK} before submission...`);
      const formValues: NormalizedFormValue[] = await getNormalizedFormValues(page);
      fixedData.formValues = formValues;
      console.log(`Form values for NIK: ${NIK} (${formValues.length} items)`);
      for (const [index, formValue] of formValues.entries()) {
        console.log(`Form value #${index + 1} for NIK ${NIK}:`, formValue);
      }

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
        await page.waitForSelector('#yesButton', { visible: true });
        await page.click('#yesButton');
      } catch (_) {
        await waitEnter(
          'Failed to click #yesButton for confirmation modal. Please click the button manually, then press Enter to continue...'
        );
      }

      await sleep(1000);
    } else {
      console.warn('⚠️\tData processed but not submitted:', fixedData, '\n');
      await waitEnter('Please manually submit the form, then press Enter to continue...');
    }

    // Wait for success notification regardless of auto/manual submit path
    const succeeded = await waitForSuccessNotification(page);
    if (!succeeded) {
      return {
        status: 'error',
        reason: 'success_notification_timeout',
        description: 'Timed out waiting for success notification after 5 minutes.'
      };
    }

    // Capture final form values after submission
    console.log(`Getting form values for NIK: ${NIK} after submission...`);
    fixedData.formValues = await getNormalizedFormValues(page);

    await database.addLog({
      id: getNumbersOnly(NIK),
      data: { ...fixedData, status: 'success' },
      message: `Data for NIK: ${NIK} submitted successfully.`
    });
    console.log('✅\tData submitted successfully:', fixedData);
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
