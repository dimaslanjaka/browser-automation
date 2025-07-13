import { parse } from 'csv-parse/sync';
import fs from 'fs';
import moment from 'moment';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvFilePath = path.join(__dirname, 'data.csv');
const csvContent = fs.readFileSync(csvFilePath, 'utf-8');

/**
 * @type {import('../globals').ExcelRowData4[]}
 */
const records = parse(csvContent, {
  columns: true,
  skip_empty_lines: true
});
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
 * @type {import('../globals').ExcelRowData[]}
 */
const mapped = records.map((row, index) => {
  for (const key in row) {
    const mappedKey = keyMap[key] || key;
    row[mappedKey] = row[key];
    if (mappedKey !== key) {
      delete row[key]; // Remove the old key
    }
  }
  return { ...row, rowIndex: index };
});

export const dataKunto = mapped.map((row) => {
  row.originalTglLahir = row.tgl_lahir; // Store original date for reference
  row.tgl_lahir = moment(row.tgl_lahir, 'YYYY-MM-DD').format('DD/MM/YYYY');
  return row;
});

console.log(mapped.at(0)); // Output the first mapped record to verify mapping
console.log(mapped.at(-1)); // Output the last mapped record to verify mapping
