import ansiColors from 'ansi-colors';
import { getPuppeteer } from '../puppeteer_utils.js';
import { sehatindonesiakuDb } from './sehatindonesiaku-data.js';
import {
  DataTidakSesuaiKTPError,
  ErrorDataKehadiranNotFound,
  PembatasanUmurError,
  UnauthorizedError
} from './sehatindonesiaku-errors.js';
import { getRegistrasiData, processRegistrasiData } from './sehatindonesiaku-registrasi.js';
import { array_unique } from 'sbg-utility';
import { processKehadiranData } from './sehatindonesiaku-kehadiran.js';

async function main() {
  let needLogin = false;
  const { browser } = await getPuppeteer();
  const allData = await getRegistrasiData();
  for (const item of allData) {
    if ((await browser.pages()).length > 5) {
      (await browser.pages()).pop()?.close();
    }
    try {
      console.log(`${item.nik} - Processing registration`);
      await processRegistrasiData(await browser.newPage(), item);
      console.log(`${item.nik} - ✅ Successfully registered`);
      console.log(`${item.nik} - Processing attendance`);
      await processKehadiranData(await browser.newPage(), item);
      console.log(`${item.nik} - ✅ Successfully processed attendance`);
    } catch (e) {
      const message = ((await sehatindonesiakuDb.getLogById(item.nik))?.message ?? '').split(',');
      if (e instanceof ErrorDataKehadiranNotFound) {
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
      }
      console.error(`Error processing data for NIK ${item.nik}:`, e);
      // Break the loop on unexpected errors (uncomment below for development)
      // break;
    }

    // Wait a bit before next iteration
    await new Promise((resolve) => setTimeout(resolve, 2000));

    if (needLogin) {
      console.warn('CTRL+C after logged in');
      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // break; // Only process one item for now
  }
}

if (process.argv.some((arg) => /sehatindonesiaku-index\.(js|cjs|ts|mjs)$/.test(arg))) {
  (async () => {
    try {
      await main();
    } finally {
      await sehatindonesiakuDb.close();
    }
  })();
}
