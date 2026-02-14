import * as glob from 'glob';
import moment from 'moment-timezone';
import nikParse from 'nik-parser-jurusid';
import fs from 'node:fs';
import path from 'node:path';
import { array_random } from 'sbg-utility';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';
import { SharedPrefs } from './SharedPrefs.js';
import { containsMonth, extractMonthName, getDatesWithoutSundays } from './utils/date.js';
import { getCacheKey, getCachedData, getFileHash, saveCachedData } from './xlsx-helper.js';

// Get the absolute path of the current script for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const shared_prefs = new SharedPrefs('sheets', '.cache/shared_prefs');
const outputSheetJsonFile = path.join(process.cwd(), '.cache/sheets/debug_output.json');

/**
 * Reads Excel (.xlsx) files in the current directory and extracts data.
 *
 * @param {number|string} [startIndex=0] - The starting row index to extract data from.
 * @param {number|string} [lastIndex=Number.MAX_SAFE_INTEGER] - The ending row index to extract data until.
 * @param {Object} [options] - Optional settings.
 * @param {boolean} [options.noCache=false] - If true, disables cache and always reads from file.
 * @returns {Promise<import('../globals').ExcelRowData[]>} - A promise that resolves to an array of extracted data objects.
 */
export async function fetchXlsxData3(startIndex = 0, lastIndex = Number.MAX_SAFE_INTEGER, options = {}) {
  // Handle null/undefined for startIndex and lastIndex
  const parsedStartIndex =
    startIndex === null || startIndex === undefined
      ? 0
      : typeof startIndex === 'string'
        ? parseInt(startIndex, 10)
        : startIndex;
  const parsedLastIndex =
    lastIndex === null || lastIndex === undefined
      ? Number.MAX_SAFE_INTEGER
      : typeof lastIndex === 'string'
        ? parseInt(lastIndex, 10)
        : lastIndex;

  // Validate parsed parameters
  const finalStartIndex = isNaN(parsedStartIndex) ? 0 : parsedStartIndex;
  const finalLastIndex = isNaN(parsedLastIndex) ? Number.MAX_SAFE_INTEGER : parsedLastIndex;

  const files = await glob.glob('.cache/sheets/*.xlsx', {
    cwd: process.cwd(),
    absolute: true
  });

  if (files.length === 0) {
    throw new Error('No Excel files found.');
  }

  // Generate file hash and cache key
  const fileHash = getFileHash(files[0]);
  const cacheKey = getCacheKey('fetchXlsxData3', fileHash, finalStartIndex, finalLastIndex);

  // Check cache first
  if (!options.noCache) {
    const cachedData = getCachedData(cacheKey);
    if (cachedData) {
      return cachedData;
    }
  }

  // show cache miss message when options.noCache is false
  if (!options.noCache) console.log(`Cache miss: ${cacheKey} - Processing Excel file...`);
  const workbook = XLSX.read(fs.readFileSync(files[0]), { cellDates: true });
  /** @type {Record<string, { [key: string], parsed_nik?: import('./nik-parser/type').NikData }[]>} */
  const allSheetsData = {};
  let customRangeData = {};

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

  workbook.SheetNames.forEach((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1 }); // raw array of arrays

    const headerRowIndex = 7487;
    const dataStartIndex = headerRowIndex + 1;
    const headers = raw[headerRowIndex];

    const jsonData = XLSX.utils.sheet_to_json(sheet, {
      raw: false,
      cellDates: true,
      dateNF: 'DD/MM/YYYY',
      range: dataStartIndex,
      header: headers
    });

    const rawJsonData = XLSX.utils.sheet_to_json(sheet, {
      raw: true,
      cellDates: true,
      dateNF: 'DD/MM/YYYY',
      range: dataStartIndex,
      header: headers
    });

    allSheetsData[sheetName] = jsonData.map((row, index) => {
      const rawRow = rawJsonData[index];
      let transformedRow = { rowIndex: dataStartIndex + index }; // absolute row index

      Object.values(keyMap).forEach((mappedKey) => {
        transformedRow[mappedKey] = undefined;
      });

      let sharedPrefsKey = '';
      let shared_prefs_data = {};

      for (const key of Object.keys(row)) {
        const newKey = keyMap[key] || key;
        let value = row[key];

        if (newKey === 'nik') {
          sharedPrefsKey = `nik_${value}`;
          shared_prefs_data = shared_prefs.get(sharedPrefsKey, {});
          const nik_parser_result = nikParse(value);
          transformedRow.parsed_nik = nik_parser_result.data || {};
        }

        if (newKey === 'tanggal') {
          if (value instanceof Date) {
            value = value.toLocaleDateString('en-GB'); // DD/MM/YYYY
          } else if (typeof value === 'string') {
            const matchHypens = value.match(/^\d{2}-\d{2}-\d{4}$/);
            if (matchHypens) value = value.replace(/-/g, '/');
          }

          if (containsMonth(value)) {
            if (moment(shared_prefs_data.saved_generated_date, 'DD/MM/YYYY', true).isValid()) {
              value = shared_prefs_data.saved_generated_date;
            } else {
              const newValue = array_random(
                getDatesWithoutSundays(extractMonthName(value), new Date().getFullYear(), 'DD/MM/YYYY', true)
              );
              if (moment(newValue, 'DD/MM/YYYY', true).isValid()) {
                value = newValue;
                shared_prefs_data.saved_generated_date = newValue;
              }
            }
          }

          if (!['tanggal entry'].includes(value.trim().toLowerCase()) && !value.includes('/')) {
            throw new Error(`Invalid string date: ${value}`);
          }
        }

        if (newKey === 'bb' || newKey === 'tb') {
          value = parseFloat(`${value}`.replace(',', '.')) || null;
        }

        transformedRow[newKey] = value;
      }

      const rawNikKey = Object.keys(rawRow).find((k) => (keyMap[k] || k) === 'nik');
      if (rawNikKey && rawRow[rawNikKey] !== undefined) {
        transformedRow.nik = String(rawRow[rawNikKey]).replace(/\.0+$/, '');
      }

      if (transformedRow.nik) {
        shared_prefs_data.nik = transformedRow.nik;
        shared_prefs.set(sharedPrefsKey, shared_prefs_data);
      }

      return transformedRow;
    });

    allSheetsData[sheetName] = allSheetsData[sheetName].map((row, _index) => {
      if (row.tgl_lahir && row.parsed_nik && row.parsed_nik.lahir) {
        // Enforce row.parsed_nik.lahir from row.tgl_lahir
        row.parsed_nik.original_lahir = row.parsed_nik.lahir; // backup original value
        row.parsed_nik.lahir = row.tgl_lahir;
      }
      // Enforce tgl_lahir to be in DD/MM/YYYY format
      if (!moment(row.tgl_lahir, 'DD/MM/YYYY', true).isValid()) {
        if (row.tgl_lahir.includes('-')) {
          const transform = moment(row.tgl_lahir, 'YYYY-MM-DD', true);
          if (transform.isValid()) {
            row.tgl_lahir = transform.format('DD/MM/YYYY');
          }
        } else {
          throw new Error(
            `Invalid tgl_lahir date format in row ${row.rowIndex} of sheet '${sheetName}': ${row.tgl_lahir}`
          );
        }
      }

      return row;
    });

    customRangeData = allSheetsData[sheetName].filter(
      (row) => row.rowIndex >= finalStartIndex && row.rowIndex <= finalLastIndex
    );
  });

  fs.writeFileSync(outputSheetJsonFile, JSON.stringify(allSheetsData, null, 2), 'utf8');

  // Save to cache
  saveCachedData(cacheKey, customRangeData);

  return customRangeData;
}

if (process.argv[1] === __filename) {
  (async () => {
    console.log(
      `Fetching data from Excel files... (start index: ${process.env.index_start}, end index: ${process.env.index_end})`
    );
    const datas = await fetchXlsxData3(0, 90000);
    // console.log(`Fetched ${datas.length} rows of data from Excel files.`);
    // console.log('First row:', datas[0]);
    // console.log('Last row:', datas[datas.length - 1]);
    // MUHAMMAD NATHAN ALFATIR 3578101502250001
    // 3578106311200003 NI NYOMAN ANINDYA MAHESWARI
    // const findFirst = findByNik(datas, '3578106311200003');
    // console.log('Find first:', findFirst);
    // const findLast = findByNik(datas, '3578101502250001');
    // console.log('Find last:', findLast);
    for (const data of datas) {
      if (data.nik && !/^\d+$/.test(data.nik)) {
        throw new Error(`data.nik is not numeric at rowIndex ${data.rowIndex}: ${data.nik}`);
      }
      if (data.nik.trim() == '3578106311200003') {
        console.log('Found special NIK:', data.nik, 'at rowIndex:', data.rowIndex);
        console.log('Data:', data);
      }
    }
  })();
}
