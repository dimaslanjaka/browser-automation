import 'dotenv/config.js';
import fs from 'fs-extra';
import moment from 'moment';
import { LogDatabase } from '../logHelper.js';
import { anyElementWithTextExists, getPuppeteer, waitForDomStable } from '../puppeteer_utils.js';
import { DataItem, sehatindonesiakuDataPath } from './sehatindonesiaku-data.js';
import { clickDaftarBaru, enterSubmission, selectCalendar } from './sehatindonesiaku-utils.js';
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
  isSpecificModalVisible,
  selectGender,
  selectPekerjaan,
  selectTanggalLahir
} from './sehatindonesiaku-staging.js';
import { Browser, Page } from 'puppeteer';
import { DataTidakSesuaiKTPError, PembatasanUmurError, UnauthorizedError } from './sehatindonesiaku-errors.js';

const provinsi = 'DKI Jakarta';
const kabupaten = 'Kota Adm. Jakarta Barat';
const kecamatan = 'Kebon Jeruk';
const kelurahan = 'Kebon Jeruk';
const db = new LogDatabase('sehatindonesiaku-kemkes');

async function main() {
  const { browser } = await getPuppeteer();
  const allData = await getData();

  // const sampleData = allData.find((item) => item.nik === '3173051407091002');
  // await processData(browser, sampleData);

  for (const item of allData) {
    // Check if data for this NIK is already processed
    const cachedData = db.getLogById(item.nik);
    if (
      cachedData &&
      cachedData.data &&
      typeof cachedData.data === 'object' &&
      Object.keys(cachedData.data).length > 0
    ) {
      console.log(`Data for NIK: ${item.nik} already processed. Skipping...`);
      continue; // Skip this item if already processed
    }

    try {
      await processData(browser, item);
    } catch (e) {
      if (e instanceof DataTidakSesuaiKTPError) {
        console.warn(`Data tidak sesuai KTP untuk NIK ${item.nik}:`);
        db.addLog({ id: item.nik, message: 'Data tidak sesuai KTP', data: item });
        continue; // Skip this item and continue with the next
      } else if (e instanceof PembatasanUmurError) {
        console.warn(`Pembatasan umur untuk NIK ${item.nik}:`);
        db.addLog({ id: item.nik, message: 'Pembatasan umur', data: item });
        continue; // Skip this item and continue with the next
      } else if (e instanceof UnauthorizedError) {
        console.warn(`Login required, please login manually from opened browser. (close browser manual)`);
        break;
      }
      console.error(`Error processing data for NIK ${item.nik}:`, e);
      // Break the loop on unexpected errors
      break;
    }

    break; // Remove this break to process all data items
  }
}

async function processData(browser: Browser, item: DataItem) {
  // Close tab when more than 5 tabs open
  const pages = await browser.pages();
  if (pages.length > 5) {
    console.log(`Closing excess tab, current open tabs: ${pages.length}`);
    await pages[0].close(); // Close the first tab
  }
  // Create a new page for each data item
  console.log(`Processing data for NIK ${item.nik}`);
  const page = await browser.newPage();
  const isLoggedIn = await enterSubmission(page);
  if (!isLoggedIn) throw new UnauthorizedError();
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
    console.log(`${item.nik} - Data processed successfully!`);
    // Save the data to database
    db.addLog({
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

      // Only include items that are NOT past, NOT empty NIK, NOT empty tanggal, and NOT empty item
      return !isPast && !isNikEmpty && !isEmptyItem;
    });
  return sehatindonesiakuData;
}

main();
