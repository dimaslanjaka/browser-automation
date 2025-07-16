import fs from 'fs';
import path from 'path';
import moment from 'moment';
import { fileURLToPath } from 'url';
import csvParser from 'csv-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export async function loadCsvData() {
  return new Promise((resolve, reject) => {
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
          row.tgl_lahir = moment(row.tgl_lahir, 'YYYY-MM-DD').format('DD/MM/YYYY');
          return row;
        });

        // Save as JSON (optional)
        const outputDir = path.join(process.cwd(), 'public/assets/data');
        fs.mkdirSync(outputDir, { recursive: true });
        fs.writeFileSync(path.join(outputDir, 'dataKunto.json'), JSON.stringify(dataKunto, null, 2), 'utf-8');

        resolve(dataKunto);
      })
      .on('error', reject);
  });
}

// loadCsvData().then((data) => {
//   console.log(`Loaded ${data.length} records from CSV.`);
//   console.log(data.at(0)); // Output the first mapped record to verify mapping
//   console.log(data.at(-1)); // Output the last mapped record to verify mapping
// });
