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
import { DataItem, sehatindonesiakuDb } from './sehatindonesiaku-data.js';
import { ErrorDataKehadiranNotFound, UnauthorizedError } from './sehatindonesiaku-errors.js';
import { getRegistrasiData } from './sehatindonesiaku-registrasi.js';
import { enterSehatIndonesiaKu } from './sehatindonesiaku-utils.js';

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
  console.log('  --dbtype      Type of database to use (db or excel). Default: excel');
}

if (process.argv.some((arg) => arg.includes('sehatindonesiaku-kehadiran'))) {
  (async () => {
    // Show help if -h or --help is passed
    if (args.h || args.help) {
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

async function main() {
  const puppeteer = await getPuppeteer();
  // Prepare data to process
  const dataType = args.dbtype || 'excel';
  let allData = await getData({ type: dataType });
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
      await processData(await puppeteer.browser.newPage(), item);
    } catch (e) {
      if (e instanceof UnauthorizedError) {
        console.error(
          `${item.nik} - UnauthorizedError: Login required. Please login first using sehatindonesiaku-login. (close browser and rerun the script after login)`
        );
        break; // Stop processing further if unauthorized
      } else if (e instanceof ErrorDataKehadiranNotFound) {
        console.error(`${item.nik} - Error: Data Kehadiran not found.`);
        const message = ((await sehatindonesiakuDb.getLogById(item.nik))?.message ?? '').split(',');
        message.push('Data Kehadiran not found');
        await sehatindonesiakuDb.addLog({
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

export interface DataOptions {
  shuffle?: boolean;
  single?: boolean;
  type?: 'db' | 'excel';
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
async function getData(options?: DataOptions): Promise<DataItem[]> {
  const defaultOptions: DataOptions = { shuffle: false, single: false, type: 'excel' };
  options = { ...defaultOptions, ...options };
  const data = options.type === 'db' ? await sehatindonesiakuDb.getLogs<DataItem>() : await getRegistrasiData();
  console.log(`Total data items retrieved from ${options.type}: ${data.length}`);
  const filtered = data.filter((item) => {
    // Support both flat and wrapped data
    const d = item.data || item;
    if (!d || typeof d.nik !== 'string' || d.nik.length === 0) return false;
    // Allow if 'hadir' is missing or explicitly false
    if (!('hadir' in d) || d.hadir === false) return true;
    return false;
  });
  console.log(`Total filtered data items: ${filtered.length}`);
  // Map to flat DataItem
  let map = filtered.map((item) => item.data || item);
  if (options.shuffle) {
    map = array_shuffle(map);
  }
  if (options.single) {
    return map.slice(0, 1);
  }
  return map;
}

async function processData(page: Page, item: DataItem) {
  const isLoggedIn = await enterSehatIndonesiaKu(page);
  if (!isLoggedIn) throw new UnauthorizedError();
  await page.goto('https://sehatindonesiaku.kemkes.go.id/ckg-pendaftaran-individu', { waitUntil: 'networkidle2' });
  await waitForDomStable(page, 2000, 5000);
  console.log(`${item.nik} - change search type to NIK`);
  // Select search dropdown <div data-v-c491f920="" class="h-[2.9rem] w-full flex cursor-pointer items-center justify-start overflow-hidden border-none bg-transparent pl-4 text-sm focus:outline-none text-black">Nomor Tiket</div>
  await clickElementByText(page, 'div.cursor-pointer', 'Nomor Tiket');
  await sleep(200);
  await clickElementByText(page, 'div.cursor-pointer', 'NIK');
  // Search for NIK <input id="nik" type="text" class="form-input border-gray-3 focus-within:border-black pl-12 border-rd-r-lg border-rd-l-0" name="NIK" placeholder="Masukkan NIK" autocomplete="off" maxlength="19">
  await page.focus('#nik');
  await page.type('#nik', item.nik, { delay: 100 });
  // Press enter on input
  await page.keyboard.press('Enter');
  await waitForDomStable(page, 2000, 10000);
  await sleep(1000);
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
  // Check sudah hadir text <div data-v-7b617409="" class="w-[50%] lt-sm:w-full text-[12px] font-600 text-[#16B3AC] flex items-center gap-2 justify-center"><img data-v-7b617409="" src="/images/icons/icon-success.svg" class="w-[13.33px] h-[13.33px]"> Sudah Hadir </div>
  if (await anyElementWithTextExists(page, 'div.w-full', 'Sudah Hadir')) {
    console.log(`${item.nik} - already marked as hadir`);
    const message = ((await sehatindonesiakuDb.getLogById(item.nik))?.message ?? '').split(',');
    message.push('Data sudah hadir');
    await sehatindonesiakuDb.addLog({
      id: item.nik,
      data: { ...item, hadir: true },
      message: array_unique(message).join(',')
    });
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
  const message = ((await sehatindonesiakuDb.getLogById(item.nik))?.message ?? '').split(',');
  message.push('Data hadir confirmed');
  await sehatindonesiakuDb.addLog({
    id: item.nik,
    data: { ...item, hadir: true },
    message: array_unique(message).join(',')
  });
}

export { main as mainKehadiran, processData as processKehadiranData, getData as getKehadiranData };
