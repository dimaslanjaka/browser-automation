import { getPuppeteer } from '../../src/puppeteer_utils.js';
import { getExcelData, getSehatIndonesiaKuDb } from '../../src/runner/sehatindonesiaku-data.js';
import { processRegistrasiData } from '../../src/runner/sehatindonesiaku-registrasi.js';

async function main() {
  const db = await getSehatIndonesiaKuDb();
  const data = (await getExcelData()).find((item) => item.nik === '3173055506680016');
  if (!data) {
    throw new Error('Data not found');
  }
  const { page } = await getPuppeteer({ devtools: true, headless: false });

  try {
    console.log(`Process`, data);
    await processRegistrasiData(page, data, db);
  } catch (error) {
    console.error('Error processing registrasi data:', error);
  }
}

main().catch(console.error);
