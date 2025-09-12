import minimist from 'minimist';
import { normalizePathUnix } from 'sbg-utility';
import { sleep } from '../utils-browser.js';
import { getExcelData, getSehatIndonesiaKuDb } from './sehatindonesiaku-data.js';
import fs from 'fs-extra';

const args = minimist(process.argv.slice(2), { alias: { h: 'help' } });

async function main() {
  await getSehatIndonesiaKuDb().initialize();
  let allData = await getExcelData();
  if (args.nik) {
    allData = allData.filter((item) => item.nik === args.nik);
  }
  for (const item of allData) {
    console.log(`${item.nik} - Removing existing log`);
    await getSehatIndonesiaKuDb().removeLog(item.nik);
    await sleep(100);
  }
  if (getSehatIndonesiaKuDb().sqliteDbPath && fs.existsSync(getSehatIndonesiaKuDb().sqliteDbPath)) {
    await getSehatIndonesiaKuDb().close();
    console.log(`Deleting sqlite database path: ${getSehatIndonesiaKuDb().sqliteDbPath}`);
    await fs.remove(getSehatIndonesiaKuDb().sqliteDbPath).catch((error) => {
      console.error('Error deleting database file:', (error as Error).message);
    });
  }
}

function showHelp() {
  const [node, script] = process.argv;
  console.log(`Usage: ${normalizePathUnix(node)} ${normalizePathUnix(script)} [options]`);
  console.log('');
  console.log('Description:');
  console.log('  Remove/clean log entries from the kemkes database.');
  console.log('');
  console.log('Options:');
  console.log('  -h, --help         Show this help message');
  console.log('  --nik <NIK>        Only remove log for the specified NIK');
  console.log('');
  console.log('Examples:');
  console.log('  sehatindonesiaku-cleanDB');
  console.log('  sehatindonesiaku-cleanDB --nik 1234567890123456');
}

if (process.argv.some((arg) => /sehatindonesiaku-cleanDB\.(js|ts|cjs|mjs)$/.test(arg))) {
  (async () => {
    try {
      if (args.help || args.h) {
        showHelp();
        return;
      }
      await main();
    } finally {
      await getSehatIndonesiaKuDb().close();
    }
  })();
}
