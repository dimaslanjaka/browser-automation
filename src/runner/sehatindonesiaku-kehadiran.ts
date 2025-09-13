import fs from 'fs-extra';
import minimist from 'minimist';
import { Page } from 'puppeteer';
import { array_shuffle, array_unique, normalizePathUnix } from 'sbg-utility';
import { ElementNotFoundError } from '../puppeteer-errors.cjs';
import {
  anyElementWithTextExists,
  clickElementByText,
  getPuppeteer,
  isElementExist,
  waitForDomStable
} from '../puppeteer_utils.js';
import { sleep } from '../utils-browser.js';
import { getSehatIndonesiaKuDb, sehatindonesiakuDataPath } from './sehatindonesiaku-data.js';
import { DataItem } from './types.js';
import { ErrorDataKehadiranNotFound, UnauthorizedError } from './sehatindonesiaku-errors.js';
import { enterSehatIndonesiaKu } from './sehatindonesiaku-utils.js';
import { LogDatabase } from '../database/LogDatabase.js';

const args = minimist(process.argv.slice(2), {
  boolean: ['help', 'single', 'shuffle'],
  alias: { h: 'help', s: 'single', sh: 'shuffle' }
});

export function showHelp() {
  const [node, script] = process.argv;
  console.log(`Usage: ${normalizePathUnix(node)} ${normalizePathUnix(script)} [options]`);
  console.log('');
  console.log('Options:');
  console.log('  -h, --help     Show help');
  console.log('  -s, --single   Process a single item');
  console.log('  -sh, --shuffle      Shuffle the order of data items before processing');
}

if (process.argv.some((arg) => arg.includes('sehatindonesiaku-kehadiran'))) {
  (async () => {
    // Show help if -h or --help is passed
    if (args.h || args.help) {
      showHelp();
      return;
    }
    let db;
    try {
      db = await getSehatIndonesiaKuDb();
      await main(db);
    } finally {
      if (db) await db.close();
    }
  })();
}

async function main(db) {
  const puppeteer = await getPuppeteer();
  // Prepare data to process
  let allData = await getData(db);
  // Shuffle data if --shuffle is passed
  if (args.shuffle || args.sh) {
    allData = array_shuffle(allData);
  }
  // If --single or -s is passed, keep only the first item
  if (args.single || args.s) {
    if (allData.length > 1) {
      allData.splice(1); // Keep only the first item
    }
  }
  console.log(`Processing ${allData.length} items...`);
  for (const item of allData) {
    if (!item.nik) {
      console.error(`Skipping item with missing NIK: ${JSON.stringify(item)}`);
      continue;
    }
    try {
      if ((await puppeteer.browser.pages()).length > 3) {
        // Close first page
        const pages = await puppeteer.browser.pages();
        await pages[0].close();
      }
      await processData(await puppeteer.browser.newPage(), item, db);
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        console.error(
          `${item.nik} - UnauthorizedError: Login required. Please login first using sehatindonesiaku-login. (close browser and rerun the script after login)`
        );
        break; // Stop processing further if unauthorized
      }
      if (e instanceof ErrorDataKehadiranNotFound) {
        console.error(`${item.nik} - Error: Data Kehadiran not found.`);
        const message = ((await db.getLogById(item.nik))?.message ?? '').split(',');
        message.push('Data Kehadiran not found');
        await db.addLog({
          id: item.nik,
          data: { ...item, hadir: false },
          message: array_unique(message).join(',')
        });
        continue; // Continue to next item
      }
      console.error(`${item.nik} - Error processing data: ${(e as Error).message}`);
      console.error((e as Error).stack);
    }
    if (args.single || args.s) break; // Process only one item
  }

  console.log('All data processed. Closing browser...');
  await sleep(2000);
  await puppeteer.browser.close();
  process.exit(0);
}

async function getExcelData(db) {
  const rawData: DataItem[] = JSON.parse(fs.readFileSync(sehatindonesiakuDataPath, 'utf-8'));
  for (let i = rawData.length - 1; i >= 0; i--) {
    const item = rawData[i];
    if (item.nik && typeof item.nik === 'string' && item.nik.trim().length === 16) {
      // Merge DB data if exists
      const dbItem = await db.getLogById(item.nik);
      let merged = { ...item };
      if (dbItem && dbItem.data) {
        merged = { ...merged, ...dbItem.data };
      }
      if (!('registered' in merged)) {
        // Remove unregistered participants
        rawData.splice(i, 1);
        console.log(`${item.nik}: ${item.nama} - Exclude unregistered`);
      }
    } else {
      // Remove invalid NIK
      rawData.splice(i, 1);
    }
  }
  return rawData;
}

export interface DataOptions {
  shuffle?: boolean;
  single?: boolean;
}

/**
 * Retrieves a filtered list of data items to process for kehadiran (attendance).
 *
 * The function sources data either from the database logs or from Kemkes data,
 * depending on the `type` option provided. It then filters the data to include only items:
 * - Whose `data` property exists and contains a non-empty `nik` value.
 * - That do not already have the `hadir` property in their `data` (i.e., not yet marked as hadir).
 *
 * The returned list can be shuffled or limited to a single item based on the options.
 *
 * @param options Optional configuration for data retrieval:
 *   - shuffle: If true, randomizes the order of the returned items.
 *   - single: If true, returns only the first item after filtering (useful for single processing).
 *   - type: Source of data, either 'db' (database logs) or 'excel' (Kemkes data). Defaults to 'excel'.
 * @returns Promise resolving to an array of DataItem objects to process.
 */
async function getData(db, options?: DataOptions): Promise<DataItem[]> {
  const defaultOptions: DataOptions = { shuffle: false, single: false };
  options = { ...defaultOptions, ...options };
  const data = await getExcelData(db);
  console.log(`Total data items retrieved: ${data.length}`);
  let filtered = data.filter((item) => {
    if (!item || typeof item.nik !== 'string' || item.nik.length === 0) return false;
    // Allow if 'hadir' is missing
    if (!('hadir' in item)) return true;
    return false;
  });
  console.log(`Total filtered data items: ${filtered.length}`);
  if (options.shuffle) {
    filtered = array_shuffle(filtered);
  }
  if (options.single) {
    return filtered.slice(0, 1);
  }
  return filtered;
}

async function processData(page: Page, item: DataItem, db: LogDatabase) {
  const isLoggedIn = await enterSehatIndonesiaKu(page);
  if (!isLoggedIn) throw new UnauthorizedError();
  await page.goto('https://sehatindonesiaku.kemkes.go.id/ckg-pendaftaran-individu', { waitUntil: 'networkidle2' });
  await waitForDomStable(page, 2000, 5000);
  await searchNik(page, item.nik);
  // Check if data not found
  const isNoDataFound = await page.evaluate(() => {
    const el = document.querySelectorAll('.table-individu-terdaftar .font-bold');
    if (el.length === 0) return false;
    return Array.from(el).some(
      (item) => (item as HTMLElement).innerText.trim().toLowerCase() === 'data tidak ditemukan'
    );
  });
  console.log(`${item.nik} - isNoDataFound: ${isNoDataFound}`);
  if (isNoDataFound) {
    throw new ErrorDataKehadiranNotFound(item.nik);
  }
  if (await checkAlreadyHadir(page, item, db)) {
    return;
  }
  // Click <button type="button" class="w-fill btn-fill-primary h-11"><div class="flex flex-row justify-center gap-2"><!----><div class="tracking-wide">Konfirmasi Hadir <!----></div></div></button>
  if (!(await clickElementByText(page, 'button.w-fill', 'Konfirmasi Hadir'))) {
    throw new ElementNotFoundError('Konfirmasi Hadir button not found or not clickable');
  }
  await waitForDomStable(page, 2000, 10000);
  await sleep(1000);
  // Check checkbox <div><input id="verify" name="verify" type="checkbox" class="" value="false"><div id="verify" class="check"></div></div>
  console.log(`${item.nik} - checking hadir checkbox`);
  let checkboxFound = false;
  for (const verifyCheckboxSelector of ['div#verify', '[name="verify"]']) {
    if (await isElementExist(page, verifyCheckboxSelector, { visible: true })) {
      const el = await page.evaluateHandle((selector) => {
        const checkbox = document.querySelector(selector) as HTMLInputElement;
        if (checkbox) {
          checkbox.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
        return checkbox;
      }, verifyCheckboxSelector);
      await el.click();
      // await page.evaluate(() => {
      //   const checkbox = document.querySelector('input#verify') as HTMLInputElement;
      //   // Scroll to checkbox
      //   if (checkbox) {
      //     checkbox.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      //   }
      //   // Click checkbox if not already checked
      //   if (checkbox && !checkbox.checked) {
      //     checkbox.click();
      //     // Trigger change event
      //     const event = new Event('change', { bubbles: true });
      //     checkbox.dispatchEvent(event);
      //   }
      // });
      await waitForDomStable(page, 2000, 10000);
      checkboxFound = true;
      break;
    } else {
      console.log(`${item.nik} - ${verifyCheckboxSelector} checkbox not found`);
    }
  }

  if (!checkboxFound) {
    throw new ElementNotFoundError('Checkbox verify not found');
  }

  // Click hadir button <button type="button" class="w-fill btn-fill-primary h-11"><div class="flex flex-row justify-center gap-2"><!----><div class="tracking-wide">Hadir <!----></div></div></button>
  await clickElementByText(page, 'button.w-fill', 'Hadir');
  await waitForDomStable(page, 2000, 10000);
  // Click tutup button on modal <div class="flex flex-row justify-center gap-2"><!----><div class="tracking-wide">Tutup <!----></div></div>
  await clickElementByText(page, 'div.flex.flex-row.justify-center.gap-2', 'Tutup');
  await waitForDomStable(page, 2000, 10000);
  console.log(`${item.nik} - hadir confirmed`);
  const message = ((await db.getLogById(item.nik))?.message ?? '').split(',');
  message.push('Data hadir confirmed');
  await db.addLog({
    id: item.nik,
    data: { ...item, hadir: true },
    message: array_unique(message).join(',')
  });
}

export async function searchNik(page: Page, nik: string) {
  console.log(`${nik} - change search type to NIK`);
  // Select search dropdown <div data-v-c491f920="" class="h-[2.9rem] w-full flex cursor-pointer items-center justify-start overflow-hidden border-none bg-transparent pl-4 text-sm focus:outline-none text-black">Nomor Tiket</div>
  await clickElementByText(page, 'div.cursor-pointer', 'Nomor Tiket');
  await sleep(200);
  await clickElementByText(page, 'div.cursor-pointer', 'NIK');
  // Search for NIK <input id="nik" type="text" class="form-input border-gray-3 focus-within:border-black pl-12 border-rd-r-lg border-rd-l-0" name="NIK" placeholder="Masukkan NIK" autocomplete="off" maxlength="19">
  await page.focus('#nik');
  await page.type('#nik', nik, { delay: 100 });
  // Press enter on input
  await page.keyboard.press('Enter');
  await waitForDomStable(page, 2000, 10000);
  await sleep(1000);
}

export async function checkAlreadyHadir(page: Page, item: DataItem, db: LogDatabase) {
  // Check sudah hadir text <div data-v-7b617409="" class="w-[50%] lt-sm:w-full text-[12px] font-600 text-[#16B3AC] flex items-center gap-2 justify-center"><img data-v-7b617409="" src="/images/icons/icon-success.svg" class="w-[13.33px] h-[13.33px]"> Sudah Hadir </div>
  if (await anyElementWithTextExists(page, 'div.w-full', 'Sudah Hadir')) {
    console.log(`${item.nik} - already marked as hadir`);
    const message = ((await db.getLogById(item.nik))?.message ?? '').split(',');
    message.push('Data sudah hadir');
    await db.addLog({
      id: item.nik,
      data: { ...item, hadir: true },
      message: array_unique(message).join(',')
    });
    return true;
  }
  return false;
}

export { getData as getKehadiranData, main as mainKehadiran, processData as processKehadiranData };
