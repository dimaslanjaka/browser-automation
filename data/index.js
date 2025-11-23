import csvParser from 'csv-parser';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { encryptJson } from '../src/utils/json-crypto.js';
import { parseDate } from '../src/utils/date.js';
import ansiColors from 'ansi-colors';
import { Transform } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from parent directory
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const csvFilePath = path.join(__dirname, 'data.csv');

if (!fs.existsSync(csvFilePath)) {
  fs.writeFileSync(csvFilePath, '');
}

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

// -------------------------------------------------------------
// ADD: comment filter stream (simple, safe, chunk-aware)
// -------------------------------------------------------------
function createCommentFilter(commentChar = '#') {
  let leftover = '';

  return new Transform({
    transform(chunk, enc, cb) {
      const text = leftover + chunk.toString();
      const lines = text.split(/\r?\n/);
      leftover = lines.pop(); // last line may be partial

      const filtered = lines.filter((line) => !line.trim().startsWith(commentChar)).join('\n');

      cb(null, filtered + '\n');
    },
    flush(cb) {
      if (leftover && !leftover.trim().startsWith('#')) {
        cb(null, leftover + '\n');
      } else {
        cb();
      }
    }
  });
}

/**
 * Load and parse CSV data from data.csv file
 * Filters out comments (lines starting with #) before parsing
 * Maps column names to standardized keys (e.g., 'NAMA' -> 'nama')
 * Parses dates and adds rowIndex to each record
 * Encrypts and saves output as dataKunto.json
 * @returns {Promise<Array<Object>>} Array of mapped and parsed CSV records
 */
export async function loadCsvData() {
  const results = await new Promise((resolve, reject) => {
    const mappedRecords = [];

    fs.createReadStream(csvFilePath)
      .pipe(createCommentFilter('#')) // <<<<<< ADD THIS
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

        const outputDir = path.join(__dirname, '../public/assets/data');
        fs.mkdirSync(outputDir, { recursive: true });
        fs.writeFileSync(path.join(outputDir, 'dataKunto.json'), encryptJson(dataKunto, process.env.VITE_JSON_SECRET));

        resolve(dataKunto);
      })
      .on('error', reject);
  });
  return results;
}

// -------------------------------------------------------------
// parseBabyName (unchanged)
// -------------------------------------------------------------
export function parseBabyName(entry) {
  let match = entry.match(/^([^,]+),\s*(BY|AN)\s*\(/i);
  if (match) return match[1].trim();

  match = entry.match(/\/\s*([A-Z].+)$/i);
  if (match) {
    return match[1].replace(/[,)]\s*$/g, '').trim();
  }

  match = entry.match(/\(([^)]+)\)/);
  if (match) return match[1].trim();

  return undefined;
}

// -------------------------------------------------------------
// Direct run (unchanged)
// -------------------------------------------------------------
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  (async () => {
    console.log('Loading CSV data...');
    const data = await loadCsvData();
    console.log(`Loaded ${data.length} records from CSV.`);
    console.log(data.at(0));
    console.log(data.at(-1));

    const aneh = data.filter((item) => /bayi/i.test(item.nama));

    console.log(
      aneh
        .map(
          (item) =>
            `${item.nama} -> ${
              parseBabyName(item.nama) ? ansiColors.greenBright(parseBabyName(item.nama)) : ansiColors.gray('undefined')
            }`
        )
        .join('\n')
    );
  })();
}
