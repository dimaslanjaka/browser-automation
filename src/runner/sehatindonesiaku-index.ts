import ansiColors from 'ansi-colors';
import { spawnAsync } from 'cross-spawn';
import { SqlError } from 'mariadb';
import minimist from 'minimist';
import { Page } from 'puppeteer';
import { array_shuffle, array_unique } from 'sbg-utility';
import { LogEntry } from '../database/BaseLogDatabase.js';
import { closeFirstTab, getPuppeteer, waitForDomStable } from '../puppeteer_utils.js';
import { noop } from '../utils-browser.js';
import { getExcelData, getSehatIndonesiaKuDb } from './sehatindonesiaku-data.js';
import {
  DataTidakSesuaiKTPError,
  ErrorDataKehadiranNotFound,
  PembatasanUmurError,
  TanggalPemeriksaanError,
  UnauthorizedError
} from './sehatindonesiaku-errors.js';
import { checkAlreadyHadir, processKehadiranData, searchNik } from './sehatindonesiaku-kehadiran.js';
import { processRegistrasiData } from './sehatindonesiaku-registrasi.js';
import { enterSehatIndonesiaKu } from './sehatindonesiaku-utils.js';
import { DataItem } from './types.js';

const args = minimist(process.argv.slice(2), {
  boolean: ['help', 'single', 'shuffle', 'priority'],
  alias: { h: 'help', s: 'single', sh: 'shuffle', prior: 'priority' },
  default: { single: false, shuffle: false, priority: false }
});

async function main() {
  // Enable unicode
  await spawnAsync('chcp', ['65001']).catch(noop);
  // Initialize database
  const db = await getSehatIndonesiaKuDb();

  let needLogin = false;
  const { browser } = await getPuppeteer();
  // Handle browser closed event to exit process
  browser.on('disconnected', () => {
    process.exit(0);
  });

  let allData = await getExcelData();

  if (args.shuffle) {
    // Shuffle array
    allData = array_shuffle(allData);
  }

  if (args.single) {
    allData = allData.slice(0, 1);
  }

  for (let i = 0; i < allData.length; i++) {
    const pages = await browser.pages();
    if (pages.length > 3) {
      console.log(`Too many pages open (${pages.length}), closing oldest...`);
      pages[0].close(); // Close the first page if exists
    }

    const item = allData[i];

    if (!item.nik) {
      console.log(`⚠️  Skipping entry with empty NIK at index ${i}`);
      continue;
    }

    if (!item.tanggal_lahir) {
      console.log(`⚠️  Skipping entry with empty Tanggal Lahir for NIK ${item.nik}`);
      continue;
    }

    const dbItem: Partial<LogEntry<DataItem>> = (await db.getLogById(item.nik)) ?? {};

    if (args.priority) {
      // Priority mode: move already processed item to the end of the list
      if (dbItem.data?.hadir && dbItem.data?.registered) {
        allData.push(item); // Move to end
        allData.splice(i, 1); // Remove from current position
        i--; // Adjust index to account for removed item
        console.log(`📝 ${item.nik} - Already processed, moving to end of the list`);
        continue;
      }
    }

    // Skip already processed items
    if (dbItem.data?.hadir && dbItem.data?.registered) {
      console.log(`📝 ${item.nik} - Already processed`);
      continue;
    }

    try {
      console.log(`📝 ${item.nik} - Checking login status`);
      await checkLoginStatus(await browser.newPage());
      await closeFirstTab(browser);

      console.log(`🔍 ${item.nik} - Checking registered status`);
      await checkRegisteredStatus(await browser.newPage(), item, db);
      await closeFirstTab(browser);

      console.log(`📝 ${item.nik} - Processing registration`);
      await processRegistrasiData(await browser.newPage(), item, db);
      console.log(`✅ ${item.nik} - ${ansiColors.green('Successfully registered')}`);
      await closeFirstTab(browser);

      console.log(`📝 ${item.nik} - Processing attendance`);
      await processKehadiranData(await browser.newPage(), item, db);
      console.log(`✅ ${item.nik} - ${ansiColors.green('Successfully processed attendance')}`);
      await closeFirstTab(browser);
    } catch (e) {
      const message = (dbItem?.message ?? '').split(',');
      if (e instanceof AlreadyHadir) {
        continue;
      } else if (e instanceof ErrorDataKehadiranNotFound) {
        console.error(`${item.nik} - Error: Data Kehadiran not found.`);
        message.push('Data Kehadiran not found');
        await db.addLog({
          id: item.nik,
          data: { ...item, hadir: false },
          message: array_unique(message).join(',')
        });
        continue; // Continue to next item
      } else if (e instanceof DataTidakSesuaiKTPError) {
        console.warn(`${item.nik} - ${ansiColors.red('Data tidak sesuai KTP')}`);
        message.push('Data tidak sesuai KTP');
        await db.addLog({
          id: item.nik,
          message: array_unique(message).join(','),
          data: { registered: false, ...item }
        });
        continue; // Skip this item and continue with the next
      } else if (e instanceof PembatasanUmurError) {
        console.warn(`Pembatasan umur untuk NIK ${item.nik}:`);
        message.push('Pembatasan umur');
        await db.addLog({
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
      } else if (e instanceof TanggalPemeriksaanError) {
        console.warn(`${item.nik} - ${ansiColors.red('Tanggal Pemeriksaan tidak valid')}: ${item.tanggal_pemeriksaan}`);
        message.push(`Tanggal Pemeriksaan tidak valid. ${item.tanggal_pemeriksaan}`);
        await db.addLog({
          id: item.nik,
          message: array_unique(message).join(','),
          data: { registered: false, ...item }
        });
        continue;
      } else if (e instanceof SqlError) {
        console.error(`SQL Error for NIK ${item.nik}:`, e.message);
        if ('sql' in e) {
          console.error('SQL:', e.sql);
        }
        console.error(e.stack);
        break;
      }
      console.error(`Error processing data for NIK ${item.nik}:`, e);
    }

    // break; // Only process one item for now (development mode)
  }

  if (!needLogin) {
    console.log('All items processed successfully');
    await browser.close();
    process.exit(0);
  }
}

async function checkLoginStatus(page: Page) {
  if (!(await enterSehatIndonesiaKu(page))) {
    throw new UnauthorizedError();
  }
}

async function checkRegisteredStatus(page: Page, item: DataItem, db) {
  await page.goto('https://sehatindonesiaku.kemkes.go.id/ckg-pendaftaran-individu', { waitUntil: 'networkidle2' });
  await waitForDomStable(page, 500, 10000);
  await searchNik(page, item.nik);
  if (await checkAlreadyHadir(page, item, db)) {
    const dbItem = (await db.getLogById(item.nik)) ?? ({} as LogEntry<DataItem>);
    const messages = (dbItem?.message ?? '').split(',');
    messages.push('Data sudah hadir');
    await db.addLog({
      id: item.nik,
      // Marked as hadir is same as already registered
      data: { ...item, hadir: true, registered: true },
      message: array_unique(messages).join(',')
    });
    throw new AlreadyHadir();
  }
}

class AlreadyHadir extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'AlreadyHadir';
  }
}

if (process.argv.some((arg) => /sehatindonesiaku-index\.(js|cjs|ts|mjs)$/.test(arg))) {
  main().catch(console.error);
}
