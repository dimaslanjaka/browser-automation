import path from 'path';
import { writefile } from 'sbg-utility';
import { getExcelData, getSehatIndonesiaKuDb } from './sehatindonesiaku-data.js';
import { DataItem, DataMerged } from './types.js';
import { encryptJson } from '../utils/json-crypto.js';

async function getData() {
  const db = await getSehatIndonesiaKuDb();
  const excelData = await getExcelData();
  let logIndex = 0;
  for (let i = 0; i < excelData.length; i++) {
    const data = excelData[i];
    if (!data.nik) {
      process.stdout.write(`\n[${logIndex}] dropping data for empty NIK\n`);
      excelData.splice(i, 1);
      i--; // Adjust index after removal
      logIndex++;
      continue;
    }
    // Find matching data in DB
    const dataDb = await db.getLogById<DataItem>(data.nik);
    if (dataDb && dataDb.id) {
      process.stdout.write(`\r[${logIndex}] modifying data for NIK : ${data.nik}`);
      excelData[i] = { ...data, ...dataDb.data, messages: (dataDb.message || '').split(',').map((s) => s.trim()) };
    } else {
      // Drop item if not found in DB
      process.stdout.write(`\r[${logIndex}] dropping data for NIK  : ${data.nik}`);
      excelData.splice(i, 1);
      i--; // Adjust index after removal
    }
    logIndex++;
  }
  await db.close();
  return excelData as DataMerged[];
}

export async function generateDataDisplay() {
  const data = await getData();
  const outputPath = path.join(process.cwd(), 'public/assets/data/sehatindonesiaku-data.json');
  writefile(outputPath, encryptJson(data, process.env.VITE_JSON_SECRET));
  console.log(`Output written to: ${outputPath}`);
}

if (process.argv.some((arg) => arg.includes('sehatindonesiaku-data-display'))) {
  generateDataDisplay();
}
