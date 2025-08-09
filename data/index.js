import csvParser from 'csv-parser';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { encryptJson } from '../src/utils/json-crypto.js';
import { parseDate } from '../src/utils/date.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from parent directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const csvFilePath = path.join(__dirname, 'data.csv');

const keyMap = {
  TANGGAL: 'tanggal',
  'TANGGAL ENTRY': 'tanggal',
  NAMA: 'nama',
  'NAMA PASIEN': 'nama',
  NIK: 'nik',
  'NIK PASIEN': 'nik',
  PEKERJAAN: 'pekerjaan',
  'BERAT BADAN': 'bb',
  BB: 'bb',
  'TINGGI BADAN': 'tb',
  TB: 'tb',
  BATUK: 'batuk',
  DM: 'diabetes',
  'TGL LAHIR': 'tgl_lahir',
  'TANGGAL LAHIR': 'tgl_lahir',
  'TANGGAL LAHIR PASIEN': 'tgl_lahir',
  ALAMAT: 'alamat',
  'ALAMAT PASIEN': 'alamat',
  'JENIS KELAMIN': 'jenis_kelamin',
  'PETUGAS YG MENG ENTRY': 'petugas',
  'PETUGAS ENTRY': 'petugas'
};

/**
 * Loads and processes CSV data from the data.csv file
 * Maps column headers using keyMap, parses dates, and saves encrypted JSON output
 * @returns {Promise<import('./types.js').DataArray>} Promise that resolves to an array of processed CSV records
 */
export async function loadCsvData() {
  /**
   * @type {import('./types.js').DataArray}
   */
  const results = await new Promise((resolve, reject) => {
    const mappedRecords = [];

    fs.createReadStream(csvFilePath)
      .pipe(csvParser())
      .on('data', (row) => {
        const mappedRow = {};
        for (const key in row) {
          const mappedKey = keyMap[key] || key;
          mappedRow[mappedKey] = row[key];
        }
        mappedRow.rowIndex = mappedRecords.length;
        mappedRecords.push(mappedRow);
      })
      .on('end', () => {
        const dataKunto = mappedRecords.map((row) => {
          row.originalTglLahir = row.tgl_lahir;
          row.tgl_lahir = parseDate(row.tgl_lahir);
          return row;
        });

        // Save as JSON (optional)
        const outputDir = path.join(__dirname, '../public/assets/data');
        fs.mkdirSync(outputDir, { recursive: true });
        fs.writeFileSync(path.join(outputDir, 'dataKunto.json'), encryptJson(dataKunto, process.env.VITE_JSON_SECRET));

        resolve(dataKunto);
      })
      .on('error', reject);
  });
  return results;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  // This module is being run directly
  (async () => {
    console.log('Loading CSV data...');
    const data = await loadCsvData();
    console.log(`Loaded ${data.length} records from CSV.`);
    console.log(data.at(0)); // Output the first mapped record to verify mapping
    console.log(data.at(-1)); // Output the last mapped record to verify mapping
  })();
}
