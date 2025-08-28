import ansiColors from 'ansi-colors';
import 'dotenv/config.js';
import fs from 'fs-extra';
import minimist from 'minimist';
import moment from 'moment';
import { Browser, Page } from 'puppeteer';
import { normalizePathUnix } from 'sbg-utility';
import { anyElementWithTextExists, getPuppeteer, waitForDomStable } from '../puppeteer_utils.js';
import {
  DataItem,
  sehatindonesiakuDataPath,
  sehatindonesiakuDb,
  sehatindonesiakuPref
} from './sehatindonesiaku-data.js';
import {
  DataTidakSesuaiKTPError,
  KuotaHabisError,
  PembatasanUmurError,
  UnauthorizedError
} from './sehatindonesiaku-errors.js';
import migrateIfNeeded from './sehatindonesiaku-migration.js';
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
} from './sehatindonesiaku-staging.js';
import { clickDaftarBaru, enterSehatIndonesiaKu, selectCalendar } from './sehatindonesiaku-utils.js';

const provinsi = sehatindonesiakuPref.getString('provinsi', 'DKI Jakarta');
const kabupaten = sehatindonesiakuPref.getString('kabupaten', 'Kota Adm. Jakarta Barat');
const kecamatan = sehatindonesiakuPref.getString('kecamatan', 'Kebon Jeruk');
const kelurahan = sehatindonesiakuPref.getString('kelurahan', 'Kebon Jeruk');
const cliArgs = minimist(process.argv.slice(2));
const isSingleData = cliArgs.single || cliArgs.s || false;

async function main() {
  const { browser } = await getPuppeteer();
  const allData = await getData();
  let needLogin = false;

  // const sampleData = allData.find((item) => item.nik === '3173051407091002');
  // await processData(browser, sampleData);

  for (const item of allData) {
    try {
      await processData(browser, item);
    } catch (e) {
      if (e instanceof DataTidakSesuaiKTPError) {
        console.warn(`${item.nik} - ${ansiColors.red('Data tidak sesuai KTP')}`);
        await sehatindonesiakuDb.addLog({ id: item.nik, message: 'Data tidak sesuai KTP', data: item });
        continue; // Skip this item and continue with the next
      } else if (e instanceof PembatasanUmurError) {
        console.warn(`Pembatasan umur untuk NIK ${item.nik}:`);
        await sehatindonesiakuDb.addLog({ id: item.nik, message: 'Pembatasan umur', data: item });
        continue; // Skip this item and continue with the next
      } else if (e instanceof UnauthorizedError) {
        needLogin = true;
        console.warn(
          `${ansiColors.redBright('Login required')}, please ${ansiColors.bold('login manually')} from opened browser. (close browser manual)`
        );
        break;
      }
      console.error(`Error processing data for NIK ${item.nik}:`, e);
      // Break the loop on unexpected errors
      // break;
    }

    if (isSingleData) break; // Process only one item if --single or -s flag is passed
  }

  if (needLogin) {
    // Keep the browser open for manual login
    return;
  }

  console.log('All data processed. Closing browser...');
  await browser.close();
  process.exit(0);
}

async function processData(browserOrPage: Browser | Page, item: DataItem) {
  // Close tab when more than 5 tabs open
  const pages = browserOrPage instanceof Browser ? await browserOrPage.pages() : await browserOrPage.browser().pages();
  if (pages.length > 5) {
    console.log(`Closing excess tab, current open tabs: ${pages.length}`);
    await pages[0].close(); // Close the first tab
  }
  // Create a new page for each data item
  console.log(`Processing data for NIK ${item.nik}`);
  const page =
    browserOrPage instanceof Browser ? await browserOrPage.newPage() : await browserOrPage.browser().newPage();
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
  const isAgeLimitCheckDisplayed =
    (await anyElementWithTextExists(page, 'div.pb-2', 'Pembatasan Umur Pemeriksaan')) ||
    (await isSpecificModalVisible(page, 'Pembatasan Umur Pemeriksaan'));
  console.log(`Is age limit check displayed: ${isAgeLimitCheckDisplayed}`);
  if (isAgeLimitCheckDisplayed) {
    throw new PembatasanUmurError(item.nik);
  }

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
    console.log(`${item.nik} - Clicking "Pilih" button inside individu terdaftar table...`);
    await clickPilihButton(page);
    await waitForDomStable(page, 2000, 6000);
    console.log(`${item.nik} - Clicking "Daftarkan dengan NIK" button...`);
    await clickDaftarkanDenganNIK(page);
    await waitForDomStable(page, 2000, 6000);
  }

  if (await isSuccessModalVisible(page)) {
    console.log(`${item.nik} - ${ansiColors.green('Data processed successfully!')}`);
    // Save the data to database
    await sehatindonesiakuDb.addLog({
      id: item.nik,
      data: { ...item, status: 'success' },
      message: 'Data processed successfully'
    });
    return; // Exit after successful processing
  }

  // Check modal "Data belum sesuai KTP"
  if (isSpecificModalVisible(page, 'Data belum sesuai KTP')) {
    console.log(`${item.nik} - Data belum sesuai KTP modal is visible.`);
    throw new DataTidakSesuaiKTPError(item.nik);
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

async function getData() {
  const sehatindonesiakuData = (JSON.parse(fs.readFileSync(sehatindonesiakuDataPath, 'utf-8')) as DataItem[])
    .map((item) => {
      // Fix tanggal_pemeriksaan empty to today
      if (!item.tanggal_pemeriksaan || item.tanggal_pemeriksaan.trim() === '') {
        item.tanggal_pemeriksaan = moment().format('DD/MM/YYYY');
      }
      return item;
    })
    .filter((item) => {
      // Filter out empty item
      const isEmptyItem = !item || Object.keys(item).length === 0;
      // Filter out empty nik
      const isNikEmpty = !item.nik || item.nik.trim() === '';
      // Filter out items with past tanggal_pemeriksaan
      const today = moment().startOf('day');
      const pemeriksaanDate = moment(item.tanggal_pemeriksaan, 'DD/MM/YYYY').startOf('day');
      const isPast = pemeriksaanDate.isBefore(today);
      // Filter not have property status
      if ('status' in item && item.status === 'success') return false;
      // Filter not have property hadir
      if ('hadir' in item && item.hadir === true) return false;

      // Only include items that are NOT past, NOT empty NIK, NOT empty tanggal, and NOT empty item
      return !isPast && !isNikEmpty && !isEmptyItem;
    });
  return sehatindonesiakuData;
}

export function showHelp() {
  const [node, script] = process.argv;
  console.log(`Usage: ${normalizePathUnix(node)} ${normalizePathUnix(script)} [options]`);
  console.log('');
  console.log('Options:');
  console.log('  -h, --help     Show help');
  console.log('  -s, --single   Process only one data item');
}

if (process.argv.some((arg) => arg.includes('sehatindonesiaku-kemkes'))) {
  (async () => {
    // Show help if -h or --help is passed
    if (cliArgs.h || cliArgs.help) {
      showHelp();
      return;
    }
    try {
      await migrateIfNeeded();
      await main();
    } finally {
      await sehatindonesiakuDb.close();
    }
  })();
}

export { main as mainKemkes, processData as processKemkesData };
