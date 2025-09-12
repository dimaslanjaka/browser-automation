import { readfile, writefile } from 'sbg-utility';
import { getSehatIndonesiaKuDb, sehatindonesiakuDataPath } from './sehatindonesiaku-data.js';
import path from 'path';
import { DataItem, DataMerged } from './types.js';

const json = JSON.parse(readfile(sehatindonesiakuDataPath)) as DataItem[];

async function getData() {
  for (let i = 0; i < json.length; i++) {
    const data = json[i];
    const dataDb = await getSehatIndonesiaKuDb().getLogById<DataItem>(data.nik);
    if (dataDb && dataDb.id) {
      // console.log('data from json', data);
      // console.log('data from db', dataDb);
      json[i] = { ...data, ...dataDb.data };
      break;
    }
  }
  getSehatIndonesiaKuDb().close();
  return json as DataMerged[];
}

export async function generateDataDisplay() {
  getData().then((data) => {
    const outputPath = path.join(process.cwd(), 'public/assets/data/sehatindonesiaku-data.json');
    writefile(outputPath, JSON.stringify(data, null, 2));
    console.log(`Output written to: ${outputPath}`);
  });
}

if (process.argv.some((arg) => arg.includes('sehatindonesiaku-data-display'))) {
  generateDataDisplay();
}
