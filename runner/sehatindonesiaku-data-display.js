import '../chunk-BUSYA2B4.js';
import path from 'path';
import { writefile } from 'sbg-utility';
import { getSehatIndonesiaKuDb, getExcelData } from './sehatindonesiaku-data.js';
import { encryptJson } from '../utils/json-crypto.js';

async function getData() {
  const db = await getSehatIndonesiaKuDb();
  const excelData = await getExcelData();
  let logIndex = 0;
  for (let i = 0; i < excelData.length; i++) {
    const data = excelData[i];
    if (!data.nik) {
      process.stdout.write(`
[${logIndex}] dropping data for empty NIK
`);
      excelData.splice(i, 1);
      i--;
      logIndex++;
      continue;
    }
    const dataDb = await db.getLogById(data.nik);
    if (dataDb && dataDb.id) {
      process.stdout.write(`\r[${logIndex}] modifying data for NIK : ${data.nik}`);
      excelData[i] = { ...data, ...dataDb.data, messages: (dataDb.message || "").split(",").map((s) => s.trim()) };
    } else {
      process.stdout.write(`\r[${logIndex}] dropping data for NIK  : ${data.nik}`);
      excelData.splice(i, 1);
      i--;
    }
    logIndex++;
  }
  await db.close();
  return excelData;
}
async function generateDataDisplay() {
  const data = await getData();
  const outputPath = path.join(process.cwd(), "public/assets/data/sehatindonesiaku-data.json");
  writefile(outputPath, encryptJson(data, process.env.VITE_JSON_SECRET));
  console.log(`Output written to: ${outputPath}`);
}
if (process.argv.some((arg) => arg.includes("sehatindonesiaku-data-display"))) {
  generateDataDisplay();
}

export { generateDataDisplay };
//# sourceMappingURL=sehatindonesiaku-data-display.js.map
//# sourceMappingURL=sehatindonesiaku-data-display.js.map