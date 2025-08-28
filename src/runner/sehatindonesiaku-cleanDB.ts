import { sleep } from '../utils-browser.js';
import { sehatindonesiakuDb } from './sehatindonesiaku-data.js';
import { getKemkesData } from './sehatindonesiaku-kemkes.js';

async function main() {
  const allData = await getKemkesData();
  for (const item of allData) {
    const get = await sehatindonesiakuDb.getLogById(item.nik);
    if (typeof get === 'object' && Object.keys(get).length > 0) {
      console.log(`${item.nik} - Removing existing log`);
      await sehatindonesiakuDb.removeLog(item.nik);
      await sleep(500);
    }
  }
}

if (process.argv.some((arg) => /sehatindonesiaku-cleanDB\.(js|ts|cjs|mjs)$/.test(arg))) {
  (async () => {
    try {
      await main();
    } finally {
      await sehatindonesiakuDb.close();
    }
  })();
}
