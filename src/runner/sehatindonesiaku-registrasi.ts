import ansiColors from 'ansi-colors';
import 'dotenv/config.js';
import fs from 'fs-extra';
import minimist from 'minimist';
import moment from 'moment';
import { Browser, Page } from 'puppeteer';
import { array_shuffle, array_unique, normalizePathUnix } from 'sbg-utility';
import { anyElementWithTextExists, getPuppeteer, waitForDomStable } from '../puppeteer_utils.js';
import { DataItem, sehatindonesiakuDataPath, sehatindonesiakuDb } from './sehatindonesiaku-data.js';
import {
  DataTidakSesuaiKTPError,
  KuotaHabisError,
  PembatasanUmurError,
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
import { clickDaftarBaru, clickKembali, enterSehatIndonesiaKu, selectCalendar } from './sehatindonesiaku-utils.js';

// Address defaults moved to processData options
const cliArgs = minimist(process.argv.slice(2), { alias: { h: 'help', s: 'single', sh: 'shuffle' }, string: ['nik'] });
const isSingleData = cliArgs.single || cliArgs.s || false;
const isShuffle = cliArgs.shuffle || cliArgs.sh || false;

async function main() {
  let needLogin = false;
  const { browser } = await getPuppeteer();
  let allData = await getData();
  if (isShuffle) allData = array_shuffle(allData);

  // const sampleData = allData.find((item) => item.nik === '3173051407091002');
  // await processData(browser, sampleData);

  for (const item of allData) {
    try {
      await processData(browser, item);
    } catch (e) {
      const message = ((await sehatindonesiakuDb.getLogById(item.nik))?.message ?? '').split(',');
      if (e instanceof DataTidakSesuaiKTPError) {
        console.warn(`${item.nik} - ${ansiColors.red('Data tidak sesuai KTP')}`);
        message.push('Data tidak sesuai KTP');
        await sehatindonesiakuDb.addLog({
          id: item.nik,
          message: array_unique(message).join(','),
          data: { registered: false, ...item }
        });
        continue; // Skip this item and continue with the next
      } else if (e instanceof PembatasanUmurError) {
        console.warn(`Pembatasan umur untuk NIK ${item.nik}:`);
        message.push('Pembatasan umur');
        await sehatindonesiakuDb.addLog({
          id: item.nik,
          message: array_unique(message).join(','),
          data: { registered: false, ...item }
        });
        continue; // Skip this item and continue with the next
      } else if (e instanceof UnauthorizedError) {
        needLogin = true;
        console.warn(
          `${ansiColors.redBright('Login required')}, please ${ansiColors.bold('login manually')} from opened browser. (close browser manual)`
        );
        break;
      }
      console.error(`Error processing data for NIK ${item.nik}:`, e);
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
  console.log('All data processed. Closing browser...');
  await browser.close();
  process.exit(0);
}

interface ProcessDataOptions {
  provinsi?: string;
  kabupaten?: string;
  kecamatan?: string;
  kelurahan?: string;
}

async function processData(browserOrPage: Browser | Page, item: DataItem, options: ProcessDataOptions = {}) {
  // Merge options with hardcoded defaults
  const provinsi = options.provinsi ?? 'DKI Jakarta';
  const kabupaten = options.kabupaten ?? 'Kota Adm. Jakarta Barat';
  const kecamatan = options.kecamatan ?? 'Kebon Jeruk';
  const kelurahan = options.kelurahan ?? 'Kebon Jeruk';
  // Close tab when more than 5 tabs open
  const pages =
    typeof (browserOrPage as any).browser === 'function'
      ? await (browserOrPage as Page).browser().pages()
      : await (browserOrPage as Browser).pages();
  if (pages.length > 5) {
    console.log(`Closing excess tab, current open tabs: ${pages.length}`);
    await pages[0].close(); // Close the first tab
  }
  // Create a new page for each data item
  console.log(`Processing data for NIK ${item.nik} - ${item.nama}`);
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
  console.log(`${item.nik} - Filling common input fields...`);
  await commonInput(page, item);
  await waitForDomStable(page, 2000, 6000);

  // Input datepicker
  console.log(`${item.nik} - Selecting date of birth...`);
  await selectTanggalLahir(page, item);
  await waitForDomStable(page, 2000, 6000);

  // Select gender (Jenis Kelamin)
  console.log(`${item.nik} - Selecting gender...`);
  await selectGender(page, item);
  await waitForDomStable(page, 2000, 6000);

  // Select pekerjaan (Pekerjaan)
  console.log(`${item.nik} - Selecting pekerjaan...`);
  await selectPekerjaan(page, item);
  await waitForDomStable(page, 2000, 6000);

  // Select address
  console.log(`${item.nik} - Selecting address...`);
  await clickAddressModal(page);
  await clickProvinsi(page, provinsi);
  await clickKabupatenKota(page, kabupaten);
  await clickKecamatan(page, kecamatan);
  await clickKelurahan(page, kelurahan);
  await waitForDomStable(page, 2000, 6000);

  // Select calendar date pemeriksaan
  console.log(`${item.nik} - Selecting tanggal pemeriksaan...`);
  await selectCalendar(page, item.tanggal_pemeriksaan);
  await waitForDomStable(page, 2000, 6000);

  // click submit button
  console.log(`${item.nik} - Submitting form...`);
  await clickSubmit(page);
  await waitForDomStable(page, 2000, 6000);

  // Handle age restriction modal
  await isPembatasanUmurVisible(page, item);

  // Handle modal "Kuota pemeriksaan habis"
  const isKuotaHabisVisible = await isSpecificModalVisible(page, 'Kuota pemeriksaan habis');
  console.log(`Modal "Kuota pemeriksaan habis" visible: ${isKuotaHabisVisible}`);
  if (isKuotaHabisVisible) {
    const isClicked = await handleKuotaHabisModal(page);
    if (!isClicked) {
      throw new KuotaHabisError(item.nik);
    }
    await waitForDomStable(page, 2000, 6000);
  }

  // Handle modal formulir pendaftaran
  console.log(`${item.nik} - Handling formulir pendaftaran modal...`);
  const isModalRegistrationVisible = await isSpecificModalVisible(page, 'formulir pendaftaran');
  console.log(`Modal formulir pendaftaran visible: ${isModalRegistrationVisible}`);
  if (isModalRegistrationVisible) {
    // Re-check pembatasan umur
    await isPembatasanUmurVisible(page, item);
    // Click pilih
    console.log(`${item.nik} - Clicking "Pilih" button inside individu terdaftar table...`);
    await clickPilihButton(page);
    await waitForDomStable(page, 2000, 6000);
    console.log(`${item.nik} - Clicking "Daftarkan dengan NIK" button...`);
    await clickDaftarkanDenganNIK(page);
    await waitForDomStable(page, 2000, 6000);
  }

  if (await isSuccessModalVisible(page)) {
    console.log(`${item.nik} - ${ansiColors.green('Data registered successfully!')}`);
    // Save the data to database
    const message = ((await sehatindonesiakuDb.getLogById(item.nik))?.message ?? '').split(',');
    message.push('Data registered successfully');
    await sehatindonesiakuDb.addLog({
      id: item.nik,
      data: { ...item, registered: true },
      message: array_unique(message).join(',')
    });
    return; // Exit after successful processing
  }

  // Handle modal "Peserta Menerima Pemeriksaan"
  if (await isSpecificModalVisible(page, 'Peserta Menerima Pemeriksaan')) {
    console.log(`${item.nik} - Peserta Menerima Pemeriksaan modal is visible.`);
    await clickKembali(page);
    // Save the data to database
    const message = ((await sehatindonesiakuDb.getLogById(item.nik))?.message ?? '').split(',');
    message.push('Peserta Sudah Menerima Pemeriksaan');
    await sehatindonesiakuDb.addLog({
      id: item.nik,
      data: { ...item, registered: true },
      message: array_unique(message).join(',')
    });
    return;
  }

  // Check modal "Data belum sesuai KTP"
  if (await isSpecificModalVisible(page, 'Data belum sesuai KTP')) {
    console.log(`${item.nik} - Data belum sesuai KTP modal is visible.`);
    throw new DataTidakSesuaiKTPError(item.nik);
  }
}

export async function isPembatasanUmurVisible(page: Page, item: DataItem) {
  const isAgeLimitCheckDisplayed =
    (await anyElementWithTextExists(page, 'div.pb-2', 'Pembatasan Umur Pemeriksaan')) ||
    (await isSpecificModalVisible(page, 'Pembatasan Umur Pemeriksaan'));
  console.log(`Is age limit check displayed: ${isAgeLimitCheckDisplayed}`);
  if (isAgeLimitCheckDisplayed) {
    throw new PembatasanUmurError(item.nik);
  }
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
  let rawData: DataItem[] = JSON.parse(fs.readFileSync(sehatindonesiakuDataPath, 'utf-8'));

  // Filter by NIK if provided
  if (options.nik && options.nik.length > 0) {
    rawData = rawData.filter((item) => options.nik!.includes(item.nik));
    if (options.debug) {
      console.log(`Filtering rawData for NIK(s): ${options.nik.join(', ')}`);
    }
  }

  // Prepare result array
  const result: DataItem[] = [];
  for (const excelData of rawData) {
    // Skip empty or invalid NIK
    if (!excelData.nik || typeof excelData.nik !== 'string' || excelData.nik.trim().length === 0) {
      if (options.debug) {
        console.log(`Skipping row for empty/invalid NIK:`, excelData);
      }
      continue;
    }

    // Merge DB data if exists
    const dbItem = await sehatindonesiakuDb.getLogById<DataItem>(excelData.nik);
    let merged = { ...excelData };
    if (dbItem && dbItem.data) {
      merged = { ...merged, ...dbItem.data };
      if (options.debug) {
        console.log(`Merging data from DB for NIK: ${excelData.nik}`);
      }
    }

    // Fix tanggal_pemeriksaan if empty
    if (!merged.tanggal_pemeriksaan || merged.tanggal_pemeriksaan.trim() === '') {
      merged.tanggal_pemeriksaan = moment().format('DD/MM/YYYY');
      if (options.debug) {
        console.log(`Fixing empty tanggal_pemeriksaan for NIK: ${merged.nik}`);
      }
    }

    // Skip if tanggal_pemeriksaan is in the past
    const today = moment().startOf('day');
    const pemeriksaanDate = moment(merged.tanggal_pemeriksaan, 'DD/MM/YYYY').startOf('day');
    if (pemeriksaanDate.isBefore(today)) {
      if (options.debug) {
        console.log(`Skipping row for past tanggal_pemeriksaan: ${merged.nik} - ${merged.tanggal_pemeriksaan}`);
      }
      continue;
    }

    // Skip if object has 'registered' property
    if (Object.prototype.hasOwnProperty.call(merged, 'registered')) {
      if (options.debug) {
        console.log(`Skipping row for registered property: ${merged.nik}`);
      }
      continue;
    }

    result.push(merged);
  }

  if (options.debug) {
    console.log('Returning filtered data count:', result.length);
  }
  return result;
}

export function showHelp() {
  const [node, script] = process.argv;
  console.log('SehatIndonesiaku Kemkes CLI');
  console.log('----------------------------');
  console.log(`Usage: ${normalizePathUnix(node)} ${normalizePathUnix(script)} [options]`);
  console.log('');
  console.log('Options:');
  console.log('  -h, --help        Show this help message and exit');
  console.log('  -s, --single      Process only one data item (first match or filtered by --nik)');
  console.log('  -sh, --shuffle    Shuffle data before processing');
  console.log('  --nik <NIK>       Process only data with specific NIK (useful with --single)');
  console.log('');
  console.log('Examples:');
  console.log(`  ${normalizePathUnix(node)} ${normalizePathUnix(script)} --help`);
  console.log(`  ${normalizePathUnix(node)} ${normalizePathUnix(script)} --single`);
  console.log(`  ${normalizePathUnix(node)} ${normalizePathUnix(script)} --nik 1234567890123456`);
  console.log(`  ${normalizePathUnix(node)} ${normalizePathUnix(script)} --single --nik 1234567890123456`);
  console.log(`  ${normalizePathUnix(node)} ${normalizePathUnix(script)} --shuffle`);
  console.log('');
  console.log('For more information, see the documentation or README.');
}

if (process.argv.some((arg) => /sehatindonesiaku-registrasi\.(js|ts|cjs|mjs)$/i.test(arg))) {
  (async () => {
    // Show help if -h or --help is passed
    if (cliArgs.h || cliArgs.help) {
      showHelp();
      return;
    }
    try {
      await main();
    } finally {
      await sehatindonesiakuDb.close();
    }
  })();
}

export { getData as getRegistrasiData, main as mainRegistrasi, processData as processRegistrasiData };
