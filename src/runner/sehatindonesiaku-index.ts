import ansiColors from 'ansi-colors';
import { spawnAsync } from 'cross-spawn';
import { Page } from 'puppeteer';
import { array_shuffle, array_unique } from 'sbg-utility';
import { LogEntry } from '../database/BaseLogDatabase.js';
import { getPuppeteer, waitForDomStable } from '../puppeteer_utils.js';
import { noop } from '../utils-browser.js';
import { sehatindonesiakuDb } from './sehatindonesiaku-data.js';
import { DataItem } from './types.js';
import {
  DataTidakSesuaiKTPError,
  ErrorDataKehadiranNotFound,
  PembatasanUmurError,
  TanggalPemeriksaanError,
  UnauthorizedError
} from './sehatindonesiaku-errors.js';
import { checkAlreadyHadir, processKehadiranData, searchNik } from './sehatindonesiaku-kehadiran.js';
import { getRegistrasiData, processRegistrasiData } from './sehatindonesiaku-registrasi.js';
import { enterSehatIndonesiaKu } from './sehatindonesiaku-utils.js';
import minimist from 'minimist';
import { generateDataDisplay } from './sehatindonesiaku-data-display.js';

const args = minimist(process.argv.slice(2), {
  boolean: ['help', 'single', 'shuffle', 'priority'],
  alias: { h: 'help', s: 'single', sh: 'shuffle', prior: 'priority' },
  default: { single: false, shuffle: false, priority: false }
});

async function main() {
  // Enable unicode
  await spawnAsync('chcp', ['65001']).catch(noop);
  let needLogin = false;
  const { browser } = await getPuppeteer();
  // Handle browser closed event to exit process
  browser.on('disconnected', () => {
    process.exit(0);
  });

  let allData = await getRegistrasiData();

  if (args.shuffle) {
    // Shuffle array
    allData = array_shuffle(allData);
  }

  if (args.single) {
    allData = allData.slice(0, 1);
  }

  if (args.priority) {
    // Priority hadir and registered undefined
    allData.sort((a, b) => {
      if (a && !a.data?.hadir && !a.data?.registered) return -1;
      if (b && !b.data?.hadir && !b.data?.registered) return 1;
      return 0;
    });
  }

  for (let i = 0; i < allData.length; i++) {
    if ((await browser.pages()).length > 5) {
      console.log(`Total opened pages exceed limit (${(await browser.pages()).length}), closing the oldest page...`);
      const pages = await browser.pages();
      for (let j = 0; j < 3 && j < pages.length; j++) {
        await pages[j].close();
      }
    }

    const item = allData[i];
    const dbItem: Partial<LogEntry<DataItem>> = (await sehatindonesiakuDb.getLogById(item.nik)) ?? {};

    // Skip already processed items
    if (dbItem.data?.hadir && dbItem.data?.registered) {
      console.log(`📝 ${item.nik} - Already processed`);
      continue;
    }

    try {
      console.log(`📝 ${item.nik} - Checking login status`);
      await checkLoginStatus(await browser.newPage());

      console.log(`🔍 ${item.nik} - Checking registered status`);
      await checkRegisteredStatus(await browser.newPage(), item);

      console.log(`📝 ${item.nik} - Processing registration`);
      await processRegistrasiData(await browser.newPage(), item);
      console.log(`✅ ${item.nik} - ${ansiColors.green('Successfully registered')}`);

      console.log(`📝 ${item.nik} - Processing attendance`);
      await processKehadiranData(await browser.newPage(), item);
      console.log(`✅ ${item.nik} - ${ansiColors.green('Successfully processed attendance')}`);
    } catch (e) {
      const message = (dbItem?.message ?? '').split(',');
      if (e instanceof AlreadyHadir) {
        continue;
      } else if (e instanceof ErrorDataKehadiranNotFound) {
        console.error(`${item.nik} - Error: Data Kehadiran not found.`);
        message.push('Data Kehadiran not found');
        await sehatindonesiakuDb.addLog({
          id: item.nik,
          data: { ...item, hadir: false },
          message: array_unique(message).join(',')
        });
        continue; // Continue to next item
      } else if (e instanceof DataTidakSesuaiKTPError) {
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
      } else if (e instanceof TanggalPemeriksaanError) {
        console.warn(`${item.nik} - ${ansiColors.red('Tanggal Pemeriksaan tidak valid')}: ${item.tanggal_pemeriksaan}`);
        message.push(`Tanggal Pemeriksaan tidak valid. ${item.tanggal_pemeriksaan}`);
        await sehatindonesiakuDb.addLog({
          id: item.nik,
          message: array_unique(message).join(','),
          data: { registered: false, ...item }
        });
        continue;
      }
      console.error(`Error processing data for NIK ${item.nik}:`, e);
    }

    // Generate data display after each item is processed
    await generateDataDisplay();

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

async function checkRegisteredStatus(page: Page, item: DataItem) {
  await page.goto('https://sehatindonesiaku.kemkes.go.id/ckg-pendaftaran-individu', { waitUntil: 'networkidle2' });
  await waitForDomStable(page, 500, 10000);
  await searchNik(page, item.nik);
  if (await checkAlreadyHadir(page, item)) {
    const dbItem = (await sehatindonesiakuDb.getLogById(item.nik)) ?? ({} as LogEntry<DataItem>);
    const messages = (dbItem?.message ?? '').split(',');
    messages.push('Data sudah hadir');
    await sehatindonesiakuDb.addLog({
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
  (async () => {
    try {
      await main().catch(console.error);
    } finally {
      // sehatindonesiakuDb.close() is handled by SIGINT or process exit
    }
  })();
}
