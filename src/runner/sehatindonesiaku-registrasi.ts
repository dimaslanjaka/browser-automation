import ansiColors from 'ansi-colors';
import 'dotenv/config.js';
import minimist from 'minimist';
import moment from 'moment';
import { Browser, Page } from 'puppeteer';
import { array_shuffle, array_unique, normalizePathUnix } from 'sbg-utility';
import { anyElementWithTextExists, getPuppeteer, waitForDomStable } from '../puppeteer_utils.js';
import { fixKemkesDataItem, getExcelData, getSehatIndonesiaKuDb } from './sehatindonesiaku-data.js';
import { DataItem } from './types.js';
import {
  DataTidakSesuaiKTPError,
  KuotaHabisError,
  PembatasanUmurError,
  TanggalPemeriksaanError,
  UnauthorizedError
} from './sehatindonesiaku-errors.js';
import {
  clickAddressModal,
  clickDaftarkanDenganNIK,
  clickKabupatenKota,
  clickKecamatan,
  clickKelurahan,
  clickPilihButton,
  clickProvinsi,
  clickSubmit,
  commonInput,
  handleKuotaHabisModal,
  isSpecificModalVisible,
  selectGender,
  selectPekerjaan,
  selectTanggalLahir
} from './sehatindonesiaku-register-utils.js';
import {
  clickDaftarBaru,
  clickKembali,
  enterSehatIndonesiaKu,
  selectDayFromCalendar
} from './sehatindonesiaku-utils.js';

// Address defaults moved to processData options
const cliArgs = minimist(process.argv.slice(2), {
  alias: { h: 'help', s: 'single', sh: 'shuffle' },
  string: ['nik']
});
const isSingleData = cliArgs.single || cliArgs.s || false;
const isShuffle = cliArgs.shuffle || cliArgs.sh || false;

/** Normalize --nik CLI arg into string[] */
function parseNikArg(arg: unknown): string[] | undefined {
  if (!arg) return;
  if (typeof arg === 'string' || typeof arg === 'number') {
    return String(arg)
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean);
  }
  if (Array.isArray(arg)) {
    return arg
      .flatMap((n) => String(n).split(','))
      .map((n) => n.trim())
      .filter(Boolean);
  }
  return;
}

async function main() {
  let needLogin = false;
  const { browser } = await getPuppeteer();

  // Parse --nik from CLI args and pass to getData
  const nikList = parseNikArg(cliArgs.nik);
  let allData = await getData({ nik: nikList });
  if (isShuffle) allData = array_shuffle(allData);

  // const sampleData = allData.find((item) => item.nik === '3173051407091002');
  // await processData(browser, sampleData);

  for (const item of allData) {
    try {
      await processData(browser, item);
    } catch (e) {
      const message = ((await getSehatIndonesiaKuDb().getLogById(item.nik))?.message ?? '').split(',');
      if (e instanceof DataTidakSesuaiKTPError) {
        console.warn(`[registrasi] ${item.nik} - ${ansiColors.red('Data tidak sesuai KTP')}`);
        message.push('Data tidak sesuai KTP');
        await getSehatIndonesiaKuDb().addLog({
          id: item.nik,
          message: array_unique(message).join(','),
          data: { registered: false, ...item }
        });
        continue; // Skip this item and continue with the next
      } else if (e instanceof PembatasanUmurError) {
        console.warn(`[registrasi] Pembatasan umur untuk NIK ${item.nik}:`);
        message.push('Pembatasan umur');
        await getSehatIndonesiaKuDb().addLog({
          id: item.nik,
          message: array_unique(message).join(','),
          data: { registered: false, ...item }
        });
        continue; // Skip this item and continue with the next
      } else if (e instanceof UnauthorizedError) {
        needLogin = true;
        console.warn(
          `[registrasi] ${ansiColors.redBright('Login required')}, please ${ansiColors.bold('login manually')} from opened browser. (close browser manual)`
        );
        break;
      } else if (e instanceof TanggalPemeriksaanError) {
        console.warn(
          `[registrasi] ${item.nik} - ${ansiColors.red('Tanggal Pemeriksaan tidak valid')}: ${item.tanggal_pemeriksaan}`
        );
        message.push(`Tanggal Pemeriksaan tidak valid. ${item.tanggal_pemeriksaan}`);
        await getSehatIndonesiaKuDb().addLog({
          id: item.nik,
          message: array_unique(message).join(','),
          data: { registered: false, ...item }
        });
        continue;
      }

      // Break the loop on unexpected errors (uncomment below for development)
      // break;
    }

    if (isSingleData) break; // Process only one item if --single or -s flag is passed
  }

  if (needLogin) {
    // Keep the browser open for manual login
    return;
  }

  // comment below codes for development
  console.log('[registrasi] All data processed. Closing browser...');
  await browser.close();
  process.exit(0);
}

interface ProcessDataOptions {
  provinsi?: string;
  kabupaten?: string;
  kecamatan?: string;
  kelurahan?: string;
}

async function processData(browserOrPage: Browser | Page, item: Partial<DataItem>, options: ProcessDataOptions = {}) {
  // Merge options with hardcoded defaults
  const provinsi = options.provinsi ?? 'DKI Jakarta';
  const kabupaten = options.kabupaten ?? 'Kota Adm. Jakarta Barat';
  const kecamatan = options.kecamatan ?? 'Kebon Jeruk';
  const kelurahan = options.kelurahan ?? 'Kebon Jeruk';

  item = fixKemkesDataItem(item);

  // Close tab when more than 5 tabs open
  const pages =
    typeof (browserOrPage as any).browser === 'function'
      ? await (browserOrPage as Page).browser().pages()
      : await (browserOrPage as Browser).pages();
  if (pages.length > 5) {
    console.log(`[registrasi] Closing excess tab, current open tabs: ${pages.length}`);
    await pages[0].close(); // Close the first tab
  }

  // Create a new page for each data item
  console.log(`[registrasi] Processing data`, item);
  const page =
    typeof (browserOrPage as any).browser === 'function'
      ? await (browserOrPage as Page).browser().newPage()
      : await (browserOrPage as Browser).newPage();
  const isLoggedIn = await enterSehatIndonesiaKu(page);
  if (!isLoggedIn) throw new UnauthorizedError();
  await page.goto('https://sehatindonesiaku.kemkes.go.id/ckg-pendaftaran-individu', { waitUntil: 'networkidle2' });
  await waitForDomStable(page, 2000, 6000);

  await clickDaftarBaru(page);
  await waitForDomStable(page, 2000, 6000);

  // Common input
  console.log(`[registrasi] ${item.nik} - Filling common input fields...`);
  await commonInput(page, item);
  await waitForDomStable(page, 2000, 6000);

  // Input datepicker
  console.log(`[registrasi] ${item.nik} - Selecting date of birth...`);
  await selectTanggalLahir(page, item);
  await waitForDomStable(page, 2000, 6000);

  // Select gender (Jenis Kelamin)
  console.log(`[registrasi] ${item.nik} - Selecting gender...`);
  await selectGender(page, item);
  await waitForDomStable(page, 2000, 6000);

  // Select pekerjaan (Pekerjaan)
  console.log(`[registrasi] ${item.nik} - Selecting pekerjaan...`);
  await selectPekerjaan(page, item);
  await waitForDomStable(page, 2000, 6000);

  // Select address
  console.log(`[registrasi] ${item.nik} - Selecting address...`);
  await clickAddressModal(page);
  await clickProvinsi(page, provinsi);
  await clickKabupatenKota(page, kabupaten);
  await clickKecamatan(page, kecamatan);
  await clickKelurahan(page, kelurahan);
  await waitForDomStable(page, 2000, 6000);

  // Select calendar date pemeriksaan
  console.log(`[registrasi] ${item.nik} - Selecting tanggal pemeriksaan...`);
  if (!item.tanggal_pemeriksaan) {
    item.tanggal_pemeriksaan = moment().format('DD/MM/YYYY');
    console.log(
      `[registrasi] ${item.nik} - tanggal_pemeriksaan is empty, defaulting to today: ${item.tanggal_pemeriksaan}`
    );
  }
  if (!(await selectDayFromCalendar(page, item.tanggal_pemeriksaan))) {
    throw new TanggalPemeriksaanError(item.nik);
  }
  await waitForDomStable(page, 2000, 6000);

  // click submit button
  console.log(`[registrasi] ${item.nik} - Submitting form...`);
  await clickSubmit(page);
  await waitForDomStable(page, 2000, 6000);

  // Handle age restriction modal
  await isPembatasanUmurVisible(page, item);

  // Handle modal "Kuota pemeriksaan habis"
  await kuotaHabisHandler(page, item);

  // Handle modal formulir pendaftaran
  console.log(`[registrasi] ${item.nik} - Handling formulir pendaftaran modal...`);
  const isModalRegistrationVisible = await isSpecificModalVisible(page, 'formulir pendaftaran');
  console.log(`[registrasi] Modal formulir pendaftaran visible: ${isModalRegistrationVisible}`);
  if (isModalRegistrationVisible) {
    // Re-check pembatasan umur
    await isPembatasanUmurVisible(page, item);
    // Click pilih
    console.log(`[registrasi] ${item.nik} - Clicking "Pilih" button inside individu terdaftar table...`);
    await clickPilihButton(page);
    await waitForDomStable(page, 2000, 6000);
    console.log(`[registrasi] ${item.nik} - Clicking "Daftarkan dengan NIK" button...`);
    await clickDaftarkanDenganNIK(page);
    await waitForDomStable(page, 2000, 6000);
    // Re-check kuota pemeriksaan
    await kuotaHabisHandler(page, item);
  }

  if (await isSuccessModalVisible(page)) {
    console.log(`[registrasi] ${item.nik} - ${ansiColors.green('Data registered successfully!')}`);
    // Save the data to database
    const message = ((await getSehatIndonesiaKuDb().getLogById(item.nik))?.message ?? '').split(',');
    message.push('Data registered successfully');
    await getSehatIndonesiaKuDb().addLog({
      id: item.nik,
      data: { ...item, registered: true },
      message: array_unique(message).join(',')
    });
    return; // Exit after successful processing
  }

  // Handle modal "Peserta Menerima Pemeriksaan"
  if (await isSpecificModalVisible(page, 'Peserta Menerima Pemeriksaan')) {
    console.log(`[registrasi] ${item.nik} - Peserta Menerima Pemeriksaan modal is visible.`);
    await clickKembali(page);
    // Save the data to database
    const message = ((await getSehatIndonesiaKuDb().getLogById(item.nik))?.message ?? '').split(',');
    message.push('Peserta Sudah Menerima Pemeriksaan');
    await getSehatIndonesiaKuDb().addLog({
      id: item.nik,
      data: { ...item, registered: true },
      message: array_unique(message).join(',')
    });
    return;
  }

  // Check modal "Data belum sesuai KTP"
  if (await isSpecificModalVisible(page, 'Data belum sesuai KTP')) {
    console.log(`[registrasi] ${item.nik} - Data belum sesuai KTP modal is visible.`);
    throw new DataTidakSesuaiKTPError(item.nik);
  }
}

/**
 * Handles the "Kuota pemeriksaan habis" modal during the registration process.
 * If the modal is visible, attempts to close it and throws a KuotaHabisError if unsuccessful.
 * Waits for the DOM to stabilize after handling the modal.
 *
 * @param page The Puppeteer Page instance to operate on.
 * @param item The data item being processed.
 */
export async function kuotaHabisHandler(page: Page, item: Partial<DataItem>) {
  const isKuotaHabisVisible = await isSpecificModalVisible(page, 'Kuota pemeriksaan habis');
  console.log(`[registrasi] Modal "Kuota pemeriksaan habis" visible: ${isKuotaHabisVisible}`);
  if (isKuotaHabisVisible) {
    const isClicked = await handleKuotaHabisModal(page);
    if (!isClicked) throw new KuotaHabisError(item.nik);
    await waitForDomStable(page, 2000, 6000);
  }
}

export async function isPembatasanUmurVisible(page: Page, item: Partial<DataItem>) {
  const isAgeLimitCheckDisplayed =
    (await anyElementWithTextExists(page, 'div.pb-2', 'Pembatasan Umur Pemeriksaan')) ||
    (await isSpecificModalVisible(page, 'Pembatasan Umur Pemeriksaan'));
  console.log(`[registrasi] Is age limit check displayed: ${isAgeLimitCheckDisplayed}`);
  if (isAgeLimitCheckDisplayed) throw new PembatasanUmurError(item.nik);
}

async function isSuccessModalVisible(page: Page) {
  // Find all divs that could contain modals
  const modals = await page.$$('div.p-2');
  for (const modal of modals) {
    const text = await page.evaluate((el) => el.innerText, modal);
    // Check if it contains the exact success text
    if (text.includes('Berhasil Daftar')) {
      // Check if it is visible
      const visible = await page.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      }, modal);
      if (visible) return true;
    }
  }
  return false;
}

export interface getDataOptions {
  /** only process specific NIK */
  nik?: string[];
  /** enable debug mode */
  debug?: boolean;
}

async function getData(options: getDataOptions = {}) {
  let rawData: DataItem[] = await getExcelData();

  // Filter by NIK if provided
  if (options.nik?.length) {
    const nikSet = new Set(options.nik);
    rawData = rawData.filter((item) => nikSet.has(item.nik));
    if (options.debug) console.log(`[registrasi] Filtering rawData for NIK(s): ${options.nik.join(', ')}`);
  }

  const today = moment().startOf('day');
  return rawData.filter((item) => {
    // Skip empty or invalid NIK
    if (!item.nik || String(item.nik).trim().length === 0) {
      if (options.debug) console.log(`[registrasi] Skipping row for empty/invalid NIK:`, item);
      return false;
    }

    // Merge data with database
    const dbItem = getSehatIndonesiaKuDb().getLogById<DataItem>(item.nik);
    dbItem.then((db) => Object.assign(item, db?.data ?? {}));

    // Fix tanggal_pemeriksaan if empty
    if (!item.tanggal_pemeriksaan?.trim()) {
      item.tanggal_pemeriksaan = moment().format('DD/MM/YYYY');
      if (options.debug) console.log(`[registrasi] Fixing empty tanggal_pemeriksaan for NIK: ${item.nik}`);
    }

    // Skip if tanggal_pemeriksaan is in the past
    const pemeriksaanDate = moment(item.tanggal_pemeriksaan, 'DD/MM/YYYY').startOf('day');
    if (pemeriksaanDate.isBefore(today)) {
      if (options.debug)
        console.log(
          `[registrasi] Skipping row for past tanggal_pemeriksaan: ${item.nik} - ${item.tanggal_pemeriksaan}`
        );
      return false;
    }

    // Skip if object has 'registered' property
    if (Object.prototype.hasOwnProperty.call(item, 'registered')) {
      if (options.debug) console.log(`[registrasi] Skipping row for registered property: ${item.nik}`);
      return false;
    }

    return true;
  });
}

export function showHelp() {
  const [node, script] = process.argv;
  console.log('[registrasi] SehatIndonesiaku Kemkes CLI');
  console.log('[registrasi] ----------------------------');
  console.log(`[registrasi] Usage: ${normalizePathUnix(node)} ${normalizePathUnix(script)} [options]`);
  console.log('[registrasi]');
  console.log('[registrasi] Options:');
  console.log('[registrasi]   -h, --help        Show this help message and exit');
  console.log('[registrasi]   -s, --single      Process only one data item (first match or filtered by --nik)');
  console.log('[registrasi]   -sh, --shuffle    Shuffle data before processing');
  console.log('[registrasi]   --nik <NIK>       Process only data with specific NIK (useful with --single)');
  console.log('[registrasi]');
  console.log('[registrasi] Examples:');
  console.log(`[registrasi]   ${normalizePathUnix(node)} ${normalizePathUnix(script)} --help`);
  console.log(`[registrasi]   ${normalizePathUnix(node)} ${normalizePathUnix(script)} --single`);
  console.log(`[registrasi]   ${normalizePathUnix(node)} ${normalizePathUnix(script)} --nik 1234567890123456`);
  console.log(`[registrasi]   ${normalizePathUnix(node)} ${normalizePathUnix(script)} --single --nik 1234567890123456`);
  console.log(`[registrasi]   ${normalizePathUnix(node)} ${normalizePathUnix(script)} --shuffle`);
  console.log('[registrasi]');
  console.log('[registrasi] For more information, see the documentation or README.');
}

if (process.argv.some((arg) => /sehatindonesiaku-registrasi\.(js|ts|cjs|mjs)$/i.test(arg))) {
  (async () => {
    if (cliArgs.h || cliArgs.help) {
      showHelp();
      return;
    }
    try {
      await main();
    } finally {
      await getSehatIndonesiaKuDb().close();
    }
  })();
}

export { getData as getRegistrasiData, main as mainRegistrasi, processData as processRegistrasiData };
