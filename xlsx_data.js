import fs from 'node:fs';
import * as glob from 'glob';
import moment from 'moment-timezone';
import nodeXlsx from 'node-xlsx';
import path from 'node:path';
import { fileURLToPath } from 'url';
import * as XLSX from 'xlsx';

// Get the absolute path of the current script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputJsonFile = path.join(__dirname, '.cache/debug_output.json');

function getFormattedDate(date) {
  var year = date.getFullYear();

  var month = (1 + date.getMonth()).toString();
  month = month.length > 1 ? month : '0' + month;

  var day = date.getDate().toString();
  day = day.length > 1 ? day : '0' + day;

  return month + '/' + day + '/' + year;
}

/**
 * Reads Excel (.xlsx) files in the current directory and extracts data.
 *
 * @param {number} [startIndex=0] - The starting row index to extract data from.
 * @param {number} [lastIndex=Number.MAX_SAFE_INTEGER] - The ending row index to extract data until.
 * @returns {Promise<import('./globals').ExcelRowData[]>} - A promise that resolves to an array of extracted data objects.
 */
export async function fetchXlsxData(startIndex = 0, lastIndex = Number.MAX_SAFE_INTEGER) {
  const files = await glob.glob('.cache/*.xlsx', { cwd: __dirname, absolute: true });

  if (files.length === 0) {
    console.log('No Excel files found.');
    return [];
  }

  const workSheetsFromFile = nodeXlsx.parse(files[0], {
    type: 'binary',
    cellDates: true,
    cellNF: false,
    cellText: false,
    dateNF: 'DD/MM/YYYY'
  });
  let debugOutput = '';

  /** @type {import('./globals').ExcelRowData[]*/
  const debugOutputJson = [];

  console.log(workSheetsFromFile.at(0).data.at(0));

  workSheetsFromFile.forEach((sheet, sheetIndex) => {
    debugOutput += `Sheet ${sheetIndex + 1}: ${sheet.name}\n`;

    sheet.data.forEach((row, rowIndex) => {
      debugOutput += `  Row ${rowIndex + 1}: ${JSON.stringify(row)}\n`;

      if (rowIndex < startIndex || rowIndex > lastIndex) return;

      const data = {
        rowIndex,
        tanggal: row[0],
        nama: row[1],
        nik: row[2],
        pekerjaan: row[3],
        bb: row[4],
        tb: row[5],
        batuk: row[6],
        diabetes: row[7]
      };
      if (data.tanggal instanceof Date) {
        const formattedDate = getFormattedDate(data.tanggal);
        console.log(formattedDate, data.tanggal);
        data.tanggal = formattedDate;
      }
      if (!`${data.tanggal}`.includes('/') && data.tanggal != 'TANGGAL') {
        console.log(data);
        console.log(row);
        throw new Error(`INVALID DATE`);
      }
      debugOutputJson.push(data);
    });

    debugOutput += '-----------------------------\n';
  });

  const outputFile = path.join(process.cwd(), '.cache/debug_output.txt');
  fs.writeFileSync(outputFile, debugOutput, 'utf8');
  fs.writeFileSync(outputJsonFile, JSON.stringify(debugOutputJson, null, 2), 'utf8');
  console.log(`Debug output saved to: \n\t${outputFile}\n\t${outputJsonFile}`);

  return debugOutputJson;
}

/**
 * Reads Excel (.xlsx) files in the current directory and extracts data.
 *
 * @param {number} [startIndex=0] - The starting row index to extract data from.
 * @param {number} [lastIndex=Number.MAX_SAFE_INTEGER] - The ending row index to extract data until.
 * @returns {Promise<import('./globals').ExcelRowData[]>} - A promise that resolves to an array of extracted data objects.
 */
export async function fetchXlsxData2() {
  const files = await glob.glob('.cache/*.xlsx', { cwd: __dirname, absolute: true });

  if (files.length === 0) {
    throw new Error('No Excel files found.');
  }

  const workbook = XLSX.read(fs.readFileSync(files[0]), { cellDates: true });

  // Define key mapping for transformation
  const keyMap = {
    TANGGAL: 'tanggal',
    NAMA: 'nama',
    NIK: 'nik',
    PEKERJAAN: 'pekerjaan',
    'BERAT BADAN': 'bb',
    'TINGGI BADAN': 'tb',
    BATUK: 'batuk',
    DM: 'diabetes'
  };

  // Convert all sheets to JSON with mapped keys
  const allSheetsData = {};

  workbook.SheetNames.forEach((sheetName) => {
    const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      raw: false, // allows xlsx to parse dates correctly
      cellDates: true, // makes sure actual date values come as Date objects
      dateNF: 'DD/MM/YYYY'
    });
    const rawJsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      raw: true, // allows xlsx to parse dates correctly
      cellDates: true, // makes sure actual date values come as Date objects
      dateNF: 'DD/MM/YYYY'
    });

    // Process rows and transform keys
    allSheetsData[sheetName] = jsonData.map((row, index) => {
      const rawRow = rawJsonData[index]; // Get matching row from raw data
      let transformedRow = { rowIndex: index + 1 }; // Add rowIndex starting from 1

      // Initialize all mapped keys with undefined
      Object.values(keyMap).forEach((mappedKey) => {
        transformedRow[mappedKey] = undefined;
      });

      Object.keys(row).forEach((key) => {
        let newKey = keyMap[key] || key; // Map known keys, keep unknown keys
        let value = row[key];

        if (newKey === 'tanggal') {
          // Get properly parsed date from non-raw version
          if (value instanceof Date) {
            value = value.toLocaleDateString('en-GB'); // Format: DD/MM/YYYY
          }
        }

        // Convert 'bb' and 'tb' to numbers if possible
        if (newKey === 'bb' || newKey === 'tb') {
          value = parseFloat(`${value}`.replace(',', '.')) || null;
        }

        transformedRow[newKey] = value;
      });

      // Get accurate NIK from raw version (preserves large numbers)
      const rawNikKey = Object.keys(rawRow).find((k) => (keyMap[k] || k) === 'nik');
      if (rawNikKey && rawRow[rawNikKey] !== undefined) {
        // Convert to string and clean decimal part (if any)
        transformedRow.nik = String(rawRow[rawNikKey]).replace(/\.0+$/, '');
      }

      // if (!transformedRow.nik) {
      //   throw new Error(`Invalid data at row ${index + 1} in sheet '${sheetName}': Missing 'NIK'`);
      // }

      // if (!transformedRow.tanggal) {
      //   throw new Error(`Invalid data at row ${index + 1} in sheet '${sheetName}': Missing 'TANGGAL'`);
      // }

      return transformedRow;
    });
  });

  fs.writeFileSync(outputJsonFile, JSON.stringify(allSheetsData, null, 2), 'utf8');
}

/**
 * Retrieves extracted Excel data from a cached JSON file.
 *
 * @param {number} startIndex - The starting index for data extraction (inclusive).
 * @param {number} lastIndex - The ending index for data extraction (exclusive).
 * @param {string} [sheetName='Sheet1'] - The sheet name to extract data from if the cache contains multiple sheets.
 * @returns {import('./globals').ExcelRowData[]} - An array of extracted data objects.
 */
export function getXlsxData(startIndex, lastIndex, sheetName = 'Sheet1') {
  let data = JSON.parse(fs.readFileSync(outputJsonFile, 'utf-8'));

  // If the parsed data is an object (from an XLSX file), extract the specified sheet's data
  if (!Array.isArray(data)) {
    data = data[sheetName];
  }

  // Ensure indexes are within valid bounds
  if (startIndex < 0) startIndex = 0;
  if (lastIndex > data.length) lastIndex = data.length;

  // Return the extracted range of data
  return data.slice(startIndex, lastIndex);
}

export function getAge(dateString) {
  let birthDate = moment(dateString, 'DD/MM/YYYY', true); // Strict parsing for DD/MM/YYYY

  if (!birthDate.isValid()) {
    throw new Error(`Invalid date format: "${dateString}". Expected format: DD/MM/YYYY`);
  }

  let age = moment().diff(birthDate, 'years');

  // Ensure age is never negative (handles future dates)
  return Math.max(0, age);
}

if (process.argv[1] === __filename) {
  (async () => {
    await fetchXlsxData2();
    let datas = getXlsxData(1795, 1852);
    let lastItem = datas.at(-1);
    let firstItem = datas.at(0);
    console.log('first', firstItem, 'last', lastItem);
  })();
}
