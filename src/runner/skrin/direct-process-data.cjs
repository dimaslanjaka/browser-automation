'use strict';

var moment = require('moment');
var region_controller_async = require('../../../packages/nik-parser/dist/esm/region_controller_async.cjs');
var nik_validator = require('../../../packages/nik-parser/dist/esm/nik_validator.cjs');
var path = require('path');
var require$$4 = require('sbg-utility');
var findExactKelurahanFromAddress = require('../../address/findExactKelurahanFromAddress.cjs');
require('../../address/geoapify.cjs');
require('../../address/nominatim.cjs');
var puppeteer_utils = require('../../puppeteer_utils.cjs');
var skrin_puppeteer = require('../../skrin_puppeteer.cjs');
var FileLockHelper = require('../../utils/FileLockHelper.cjs');
var browser = require('../../utils/browser.cjs');
var waitEnter = require('../../../_virtual/waitEnter.cjs');
require('../../../_virtual/logs.cjs');
require('../../utils/beep.cjs');
require('moment-timezone');
var string = require('../../utils/string.cjs');
require('glob');
require('node:crypto');
require('node:fs');
require('node:path');
var fixData = require('../../utils/xlsx/fixData.cjs');
var confirmIdentityModal = require('./confirmIdentityModal.cjs');
var datePicker = require('./datePicker.cjs');
var getNormalizedFormValues = require('./getNormalizedFormValues.cjs');
var getPersonInfo = require('./getPersonInfo.cjs');
var isIdentityModalVisible = require('./isIdentityModalVisible.cjs');
var isInvalidAlertVisible = require('./isInvalidAlertVisible.cjs');
var isNikErrorVisible = require('./isNikErrorVisible.cjs');
var isNIKNotFoundModalVisible = require('./isNIKNotFoundModalVisible.cjs');
var isSessionExpiredAlertVisible = require('./isSessionExpiredAlertVisible.cjs');
var isSuccessNotificationVisible = require('./isSuccessNotificationVisible.cjs');
var removeDuplicateKeys = require('../../../_virtual/removeDuplicateKeys.cjs');

/**
 * Waits up to 5 minutes for the success notification to appear.
 * Returns true if visible within the timeout, false otherwise.
 */
async function waitForSuccessNotification(page) {
    const waitStart = Date.now();
    while (true) {
        if (await isSuccessNotificationVisible.isSuccessNotificationVisible(page)) {
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
async function resolveAndFillAddress(page, fixedData, parsedNik) {
    if (!fixedData.alamat || fixedData.alamat.length === 0) {
        throw new Error("❌ Failed to take the patient's address");
    }
    let provinsi = '', kabupatenOrKota = '', kecamatan = '', kelurahan = '';
    const parsedNikData = parsedNik?.status === 'success' ? parsedNik.data : null;
    if (!parsedNikData) {
        throw new Error(`❌ Failed to determine address: parsed NIK data is not available ` +
            `(nik=${fixedData.nik || '<unknown>'}, alamat=${fixedData.alamat || '<unknown>'})`);
    }
    console.log(`Resolving exact kelurahan for address: ${fixedData.alamat}`);
    const resolvedAddress = await findExactKelurahanFromAddress.findExactKelurahanFromAddress(parsedNikData, fixedData.alamat);
    if (!resolvedAddress) {
        throw new Error(`❌ Failed to determine address: resolver returned no result ` +
            `(nik=${fixedData.nik || '<unknown>'}, alamat=${fixedData.alamat || '<unknown>'})`);
    }
    if (resolvedAddress.geocoded) {
        fixedData._address = resolvedAddress.geocoded.raw || resolvedAddress.geocoded;
        console.log('Geocoder result:', resolvedAddress.geocoded);
    }
    console.log('Exact kelurahan resolver result:', {
        source: resolvedAddress.source,
        name: resolvedAddress.name,
        id: resolvedAddress.id
    });
    provinsi = resolvedAddress.result?.provinsi || parsedNikData.provinsi || '';
    kabupatenOrKota = resolvedAddress.result?.kotakab || parsedNikData.kotakab || '';
    kecamatan = resolvedAddress.result?.kecamatan || parsedNikData.kecamatan || parsedNikData.namaKec || '';
    kelurahan = resolvedAddress.result?.kelurahan || resolvedAddress.name || '';
    if (require$$4.isEmpty(kelurahan)) {
        throw new Error(`❌ Failed to determine kelurahan: resolver returned no kelurahan ` +
            `(nik=${fixedData.nik || '<unknown>'}, alamat=${fixedData.alamat || '<unknown>'})`);
    }
    if (typeof kelurahan !== 'string' || require$$4.isEmpty(kelurahan)) {
        console.log({ provinsi, kotakab: kabupatenOrKota, kecamatan, kelurahan });
        throw new Error('kelurahan should be string');
    }
    if (require$$4.isEmpty(provinsi) || require$$4.isEmpty(kabupatenOrKota) || require$$4.isEmpty(kecamatan) || require$$4.isEmpty(kelurahan)) {
        throw new Error(`Missing required address fields: provinsi='${provinsi}', kotakab='${kabupatenOrKota}', ` +
            `kecamatan='${kecamatan}', kelurahan='${kelurahan}'`);
    }
    console.log(`Inputting address ${provinsi} -> ${kabupatenOrKota} -> ${kecamatan} -> ${kelurahan}`);
    for (const [selector, value] of [
        ['#field_item_provinsi_ktp_id input[type="text"]', string.ucwords(provinsi)],
        ['#field_item_kabupaten_ktp_id input[type="text"]', string.ucwords(kabupatenOrKota)],
        ['#field_item_kecamatan_ktp_id input[type="text"]', string.ucwords(kecamatan)],
        ['#field_item_kelurahan_ktp_id input[type="text"]', string.ucwords(kelurahan)],
        ['#field_item_alamat_ktp textarea', fixedData.alamat]
    ]) {
        await page.waitForSelector(selector, { visible: true });
        await page.type(selector, value, { delay: 100 });
        // wait for dropdown to appear (important)
        await browser.sleep(300);
        // move to first suggestion
        await page.keyboard.press('ArrowDown');
        // select it
        await page.keyboard.press('Enter');
        await browser.sleep(200);
    }
    const invalidAlert = await isInvalidAlertVisible.isInvalidAlertVisible(page);
    if (invalidAlert.result) {
        const findAddressError = string.findInArray(invalidAlert.contents, /kabupaten/i);
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
async function fillFallbackLocationIfEmpty(page, province, city) {
    console.log(`Provinsi: ${province}`, province.length === 0 ? '(empty)' : '');
    if (province.length === 0) {
        await puppeteer_utils.typeAndTrigger(page, '#field_item_provinsi_ktp_id input[type="text"]', 'Jawa Timur');
    }
    console.log(`Kabupaten/Kota: ${city}`, city.length === 0 ? '(empty)' : '');
    if (city.length === 0) {
        await puppeteer_utils.typeAndTrigger(page, '#field_item_kabupaten_ktp_id input[type="text"]', 'Kota Surabaya');
    }
}
/**
 * Fills all "Tidak" (No) fields in the skrining form, including gender-specific,
 * age-specific (balita), diabetes, batuk, and CXR fields.
 *
 * @param page Puppeteer page instance.
 * @param ctx Context derived from the patient record and page state.
 */
async function fillAllTidakFields(page, ctx) {
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
        await puppeteer_utils.typeAndTrigger(page, selector, 'Tidak');
    }
    // Diabetes: Ya or Tidak
    await puppeteer_utils.typeAndTrigger(page, '#field_item_risiko_6_id input[type="text"]', ctx.hasDiabetes ? 'Ya' : 'Tidak');
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
            if (await puppeteer_utils.isElementExist(page, selector)) {
                const visible = await puppeteer_utils.isElementVisible(page, selector);
                console.log(`${selector} is visible: ${visible}`);
                if (visible) {
                    await puppeteer_utils.typeAndTrigger(page, selector, 'Tidak');
                    await browser.sleep(200);
                }
            }
        }
    }
    await page.keyboard.press('Tab');
    // Batuk: Tidak if no cough, otherwise handled by caller via keterangan
    if (!ctx.hasBatuk) {
        await puppeteer_utils.typeAndTrigger(page, '#field_item_gejala_2_1_id input[type="text"]', 'Tidak');
    }
    // CXR: always Tidak
    for (const selector of ['#form_item_cxr_pemeriksaan_id input', '#form_item_cxr_alasan textarea']) {
        await puppeteer_utils.typeAndTrigger(page, selector, 'Tidak');
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
async function processData(page, data, database, options = {
    skipValidateDb: false
}) {
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
    await skrin_puppeteer.autoLoginAndEnterSkriningPage(page);
    await puppeteer_utils.waitForDomStable(page, 3000, 60000);
    await page.waitForSelector('#nik', { visible: true });
    if (!data) {
        throw new Error('No more data to process.');
    }
    const NIK = data.nik;
    if (!nik_validator.isValidNIK(NIK)) {
        await database.addLog({
            id: String(NIK),
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
        const existing = await database.getLogById(browser.getNumbersOnly(NIK));
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
    const fixedData = await fixData.default(data, { autofillTanggalEntry: true, fixNamaBayi: true });
    const parsedNik = fixedData.parsed_nik || (await region_controller_async.nikParser(fixedData.nik));
    // Acquire an exclusive lock for this NIK+NAMA to prevent concurrent processing.
    const rawName = (fixedData.nama || fixedData.NAMA || data.nama || '').toString();
    const sanitizeName = (s) => s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 60);
    const lockFileName = `${browser.getNumbersOnly(NIK)}_${sanitizeName(rawName)}.lock`;
    const lockFilePath = path.join(process.cwd(), 'tmp', 'locks', lockFileName);
    const locker = new FileLockHelper.FileLockHelper(lockFilePath);
    if (!locker.lock()) {
        console.warn(`Skipping NIK ${NIK} — locked by another process (lock=${lockFilePath})`);
        return {
            status: 'error',
            reason: 'in_progress',
            description: `Another process is handling this NIK/NAMA (lock=${lockFilePath})`
        };
    }
    try {
        console.log('Processing:', removeDuplicateKeys(fixedData));
        const tanggalEntry = fixedData['TANGGAL ENTRY'] || fixedData.tanggal;
        // Always validate the date format to ensure it's in DD/MM/YYYY format, which is required by the form.
        if (!`${tanggalEntry}`.includes('/') || !tanggalEntry || tanggalEntry.length < 8) {
            throw new Error(`INVALID DATE: tanggal=${String(tanggalEntry)} (type=${typeof tanggalEntry}) - data=${JSON.stringify(fixedData, null, 2)}`);
        }
        const parseTanggal = moment(tanggalEntry, 'DD/MM/YYYY', true); // strict parsing
        // Always validate the parsed date to ensure it's a valid calendar date.
        if (!parseTanggal.isValid()) {
            throw new Error(`INVALID DATE (parse failed): tanggal=${String(tanggalEntry)} (type=${typeof tanggalEntry}) - data=${JSON.stringify(fixedData, null, 2)}`);
        }
        // Disallow Sunday dates as the system does not accept them.
        if (parseTanggal.day() === 0) {
            throw new Error(`SUNDAY DATE NOT ALLOWED: ${tanggalEntry}`);
        }
        const today = moment();
        if (options?.skipCurrentYearValidation) {
            console.warn('skipCurrentYearValidation enabled — skipping current year validation for', tanggalEntry);
        }
        else if (parseTanggal.year() !== today.year()) {
            throw new Error(`YEAR NOT ALLOWED: tanggal=${String(tanggalEntry)} (type=${typeof tanggalEntry}) - data=${JSON.stringify(fixedData, null, 2)}`);
        }
        if (options?.skipCurrentMonthValidation) {
            console.warn('skipCurrentMonthValidation enabled — skipping current month validation for', tanggalEntry);
        }
        else if (parseTanggal.month() !== today.month()) {
            const logFile = path.join(process.cwd(), `tmp/logs/invalid_month_entries/${fixedData.nik}.log`);
            const logContent = `Invalid month entry: ${tanggalEntry}\nType tanggalEntry=${typeof tanggalEntry}\nData: ${JSON.stringify(fixedData, null, 2)}\n\n`;
            require$$4.writefile(logFile, logContent);
            throw new Error(`MONTH NOT ALLOWED: tanggal=${String(tanggalEntry)} (type=${typeof tanggalEntry}) logged to ${logFile}`);
        }
        try {
            await datePicker.setDatepickerValue(page, tanggalEntry);
            await datePicker.selectDateWithUI(page, tanggalEntry, { skipMonthNavigation: true });
        }
        catch (error) {
            const description = error instanceof Error ? error.message : String(error);
            console.error('Failed to set or select tanggal entry date:', description);
            return {
                status: 'error',
                reason: 'datepicker_error',
                description: `Failed to set or select tanggal entry date: ${description}`
            };
        }
        await puppeteer_utils.typeAndTrigger(page, 'input[name="tempat_skrining_id_input"]', 'Puskesmas');
        await puppeteer_utils.typeAndTrigger(page, '#nik', browser.getNumbersOnly(NIK));
        await puppeteer_utils.waitForDomStable(page, 5000, 60000);
        // Check if the ID modal appears
        try {
            await page.waitForSelector('.k-widget.k-window.k-window-maximized', { timeout: 5000 });
        }
        catch (_e) {
            //
        }
        try {
            await page.waitForSelector('[aria-labelledby="dialogconfirm_wnd_title"]', { visible: true, timeout: 5000 });
        }
        catch (_e) {
            //
        }
        console.log('Is NIK error notification visible:', await isNikErrorVisible.isNikErrorVisible(page));
        if (await isNikErrorVisible.isNikErrorVisible(page)) {
            await waitEnter.waitEnterExports.waitEnter('Please check NIK error notification. Press Enter to continue...');
            throw new Error('NIK error notification visible, please re-check. Aborting...');
        }
        console.log('Identity modal is visible:', await isIdentityModalVisible.isIdentityModalVisible(page));
        if (await isIdentityModalVisible.isIdentityModalVisible(page)) {
            await confirmIdentityModal.confirmIdentityModal(page);
        }
        // Check if NIK not found modal visible
        const isNikNotFound = await isNIKNotFoundModalVisible.isNIKNotFoundModalVisible(page);
        console.log('Is NIK not found modal visible:', isNikNotFound);
        if (isNikNotFound) {
            const shouldClickYes = await page.evaluate(() => {
                const dialog = document.querySelector('#dialogconfirm');
                if (!dialog)
                    return false;
                const text = (dialog.innerText || dialog.textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
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
                await puppeteer_utils.typeAndTrigger(page, '#field_item_nama_peserta input[type="text"]', NAMA);
                if (!fixedData.genderInitial) {
                    throw new Error("❌ Failed to determine patient's gender from NIK");
                }
                await puppeteer_utils.typeAndTrigger(page, '#field_item_jenis_kelamin_id input[type="text"]', fixedData.gender);
                const parsedLahir = moment(fixedData.tgl_lahir, ['DD/MM/YYYY', 'YYYY-MM-DD'], true);
                if (!parsedLahir.isValid()) {
                    throw new Error(`❌ Invalid birth date format from NIK, expected DD/MM/YYYY, got: ${fixedData.tgl_lahir}`);
                }
                await puppeteer_utils.typeAndTrigger(page, '#field_item_tgl_lahir input[type="text"]', parsedLahir.format('DD/MM/YYYY'));
                await resolveAndFillAddress(page, fixedData, parsedNik);
            }
            else {
                return {
                    status: 'error',
                    reason: 'data_not_found',
                    description: 'Skipping due data not found'
                };
            }
        }
        // Get the patient's name from the form after confirming identity (or if no modal appeared)
        let nama = await page.evaluate(() => document.querySelector('input[name="nama_peserta"]')?.value);
        fixedData.nama_from_page = `${nama}`.trim();
        if (require$$4.isEmpty(`${fixedData.nama_from_page}`)) {
            const NAMA = fixedData.nama || fixedData.NAMA || '';
            if (!NAMA || NAMA.length === 0) {
                throw new Error("❌ Failed to take the patient's name");
            }
            nama = await page.evaluate(() => document.querySelector('input[name="nama_peserta"]')?.value);
            fixedData.nama_from_page = `${nama}`.trim();
            await puppeteer_utils.typeAndTrigger(page, '#field_item_nama_peserta input[type="text"]', NAMA);
        }
        if (require$$4.isEmpty(`${fixedData.nama_from_page}`)) {
            throw new Error("❌ Patient's name is empty after confirmation");
        }
        const { gender, age, birthDate, location } = await getPersonInfo.getPersonInfo(page);
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
        await puppeteer_utils.typeAndTrigger(page, 'input[name="pekerjaan_id_input"]', fixedData.pekerjaan);
        const bb = fixedData.bb || fixedData.BB || null;
        const tb = fixedData.tb || fixedData.TB || null;
        console.log(`Inputting berat badan (${bb}) dan tinggi badan (${tb}) untuk NIK: ${NIK}`);
        await page.focus('#field_item_berat_badan input[type="text"]');
        await page.type('#field_item_berat_badan input[type="text"]', browser.extractNumericWithComma(bb), { delay: 100 });
        await page.focus('#field_item_tinggi_badan input[type="text"]');
        await page.type('#field_item_tinggi_badan input[type="text"]', browser.extractNumericWithComma(tb), { delay: 100 });
        await fillAllTidakFields(page, { gender, age, hasDiabetes: !!fixedData.diabetes, hasBatuk: !!fixedData.batuk });
        // Batuk keterangan: only needed when batuk is present (hasBatuk=false is already handled inside fillAllTidakFields)
        if (fixedData.batuk) {
            const keteranganBatuk = fixedData.batuk.replace(/ya,/, 'batuk');
            if (/\d/m.test(keteranganBatuk)) {
                await puppeteer_utils.typeAndTrigger(page, '#field_item_keterangan textarea', keteranganBatuk);
                await waitEnter.waitEnterExports.waitEnter('Please fix data batuk/demam. Press Enter to continue...');
            }
            else {
                await puppeteer_utils.typeAndTrigger(page, '#field_item_keterangan textarea', '');
            }
        }
        await browser.sleep(2000);
        // Re-check if the identity modal is visible
        while (await isIdentityModalVisible.isIdentityModalVisible(page)) {
            await confirmIdentityModal.confirmIdentityModal(page);
            await browser.sleep(1000);
            if (await isIdentityModalVisible.isIdentityModalVisible(page)) {
                await waitEnter.waitEnterExports.waitEnter('Please check identity modal. Press Enter to continue...');
            }
        }
        // Resolve invalid alert — retry common fixes then wait for manual intervention
        let invalidAlert = await isInvalidAlertVisible.isInvalidAlertVisible(page);
        while (invalidAlert.result) {
            await puppeteer_utils.typeAndTrigger(page, 'input[name="tempat_skrining_id_input"]', 'Puskesmas');
            await puppeteer_utils.typeAndTrigger(page, 'input[name="pekerjaan_id_input"]', fixedData.pekerjaan);
            invalidAlert = await isInvalidAlertVisible.isInvalidAlertVisible(page);
            if (invalidAlert.result) {
                console.dir(fixedData, { depth: null });
                console.warn('⚠️ Invalid alert detected for the following data:');
                console.warn(`  ${invalidAlert.contents.join(' - ')}`);
                await waitEnter.waitEnterExports.waitEnter('Please review the alert and press Enter to continue...');
            }
        }
        // Pre-submission eligibility check
        const identityModalVisible = await isIdentityModalVisible.isIdentityModalVisible(page);
        const invalidAlertState = await isInvalidAlertVisible.isInvalidAlertVisible(page);
        const invalidAlertVisible = invalidAlertState.result;
        const nikErrorVisible = await isNikErrorVisible.isNikErrorVisible(page);
        const nikNotFoundModalVisible = await isNIKNotFoundModalVisible.isNIKNotFoundModalVisible(page);
        const sessionExpiredAlertVisible = await isSessionExpiredAlertVisible.isSessionExpiredAlertVisible(page);
        const isAllowedToSubmit = !identityModalVisible &&
            !invalidAlertVisible &&
            !nikErrorVisible &&
            !nikNotFoundModalVisible &&
            !sessionExpiredAlertVisible;
        console.log(`Submission eligibility check: identityModalVisible=${identityModalVisible}, invalidAlertVisible=${invalidAlertVisible}, nikErrorVisible=${nikErrorVisible}, nikNotFoundModalVisible=${nikNotFoundModalVisible}, sessionExpiredAlertVisible=${sessionExpiredAlertVisible}, isAllowedToSubmit=${isAllowedToSubmit}`);
        if (invalidAlertState.contents.length > 0) {
            console.log(`Invalid alert contents: ${invalidAlertState.contents.join(' | ')}`);
        }
        if (sessionExpiredAlertVisible) {
            console.warn('⚠️ Session expired alert detected. Attempting to re-login...');
            await waitEnter.waitEnterExports.waitEnter('Session expired. Please log in again, then press Enter to continue...');
            await skrin_puppeteer.autoLoginAndEnterSkriningPage(page);
            return {
                status: 'error',
                reason: 'session_expired',
                description: 'Session expired during processing. Please re-run the process for this entry after logging in again.'
            };
        }
        if (isAllowedToSubmit) {
            console.log(`Getting form values for NIK: ${NIK} before submission...`);
            const formValues = await getNormalizedFormValues.getNormalizedFormValues(page);
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
            await browser.sleep(1000);
            try {
                await page.waitForSelector('#yesButton', { visible: true });
                await page.click('#yesButton');
            }
            catch (_) {
                await waitEnter.waitEnterExports.waitEnter('Failed to click #yesButton for confirmation modal. Please click the button manually, then press Enter to continue...');
            }
            await browser.sleep(1000);
        }
        else {
            console.warn('⚠️\tData processed but not submitted:', fixedData, '\n');
            await waitEnter.waitEnterExports.waitEnter('Please manually submit the form, then press Enter to continue...');
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
        fixedData.formValues = await getNormalizedFormValues.getNormalizedFormValues(page);
        await database.addLog({
            id: browser.getNumbersOnly(NIK),
            data: { ...fixedData, status: 'success' },
            message: `Data for NIK: ${NIK} submitted successfully.`
        });
        console.log('✅\tData submitted successfully:', fixedData);
        return {
            status: 'success',
            data: fixedData
        };
    }
    finally {
        try {
            locker.unlock();
        }
        catch (_err) {
        }
    }
}

exports.processData = processData;
