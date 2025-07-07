import ExcelJS from 'exceljs';
import moment from 'moment';
import path from 'path';
import { fileURLToPath } from 'url';
import { getNumbersOnly, logInline, logLine } from './utils.js';
import { fixData, getCacheKey, getCachedData, getDataRange, getFileHash, saveCachedData } from './xlsx-helper.js';

const __filename = fileURLToPath(import.meta.url);

/**
 * Reads Excel (.xlsx) files from the .cache/sheets directory and extracts data from all header regions.
 *
 * Returns an array of row objects, each with an `originalRowNumber` and `headerRegion` property. The shape of each row depends on the detected region headers and may be a partial ExcelRowData.
 *
 * @returns {Promise<import('../globals').FetchXlsxData4Result>}
 *   A promise that resolves to an array of parsed Excel row objects, each with originalRowNumber and headerRegion.
 */
export async function fetchXlsxData4() {
  const xlsxFile = path.join(process.cwd(), '.cache', 'sheets', 'spreadsheet-' + process.env.SPREADSHEET_ID + '.xlsx');

  if (!xlsxFile) {
    throw new Error('No Excel files found in .cache/sheets directory');
  }

  // Generate file hash and cache key
  const fileHash = getFileHash(xlsxFile);
  const cacheKey = getCacheKey('fetchXlsxData4', fileHash);

  // Check cache first
  const cachedData = getCachedData(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  // Read and parse the xlsx file using streaming reader
  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(xlsxFile);
  const jsonData = [];
  let before7488Headers = null;
  let after7488Headers = null;
  const nikMap = new Map();

  for await (const worksheetReader of workbookReader) {
    let rowNumber = 0;

    for await (const row of worksheetReader) {
      rowNumber++;
      const allValues = row.values.slice(1); // slice(1) to remove the first empty element

      // Detect header rows
      if (rowNumber === 1) {
        // Assume first non-empty row is header for region 0
        if (allValues.some((v) => v && v !== '')) {
          before7488Headers = allValues;
          continue;
        }
      }
      if (rowNumber === 7488) {
        // Row 7488 contains the actual headers for region 1
        after7488Headers = allValues.slice(9, 17); // Take only the second set
        // Do not parse this row as data, just set headers and continue
        continue;
      }

      // For rows before 7488, use before7488Headers; after, use after7488Headers
      let values, usedHeaders, currentRegion;
      if (rowNumber < 7488) {
        usedHeaders = before7488Headers;
        values = allValues;
        currentRegion = 0;
      } else if (rowNumber > 7488) {
        usedHeaders = after7488Headers;
        values = allValues.slice(9, 17);
        currentRegion = 1;
      } else {
        // Skip header rows
        continue;
      }

      // Skip empty rows
      if (!values || values.length === 0 || values.every((v) => v === undefined || v === null || v === '')) {
        continue;
      }

      const rowData = {};
      values.forEach((value, index) => {
        const header = usedHeaders && usedHeaders[index];
        if (header && value !== undefined && value !== null && value !== '') {
          if ((header === 'TGL LAHIR' || header === 'TANGGAL') && typeof value === 'number') {
            // Convert Excel serial date numbers to proper birth date strings for TGL LAHIR
            const baseDate = moment('1900-01-01');
            const daysSinceBase = value - 1;
            const adjustedDays = daysSinceBase > 59 ? daysSinceBase - 1 : daysSinceBase;
            const resultDate = baseDate.clone().add(adjustedDays, 'days');
            rowData[header] = resultDate.format('DD/MM/YYYY');
          } else {
            rowData[header] = value;
          }
        }
      });

      // Only add row if it has meaningful data
      if (Object.keys(rowData).length > 0) {
        rowData.originalRowNumber = rowNumber;
        rowData.headerRegion = currentRegion;
        // Deduplicate by NIK: always keep the latest (region 1 if exists)
        if (rowData.NIK) {
          const nikKey = getNumbersOnly(rowData.NIK);
          const existing = nikMap.get(nikKey);
          if (!existing || rowData.headerRegion === 1) {
            nikMap.set(nikKey, rowData);
          }
        } else {
          jsonData.push(rowData); // fallback for rows without NIK
        }
      }
    }
    break;
  }

  // Combine deduped NIK rows and any rows without NIK
  const deduped = [...nikMap.values(), ...jsonData];
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

  // Map keys according to keyMap
  const mapped = deduped.map((row) => {
    const newRow = {};
    for (const key in row) {
      const mappedKey = keyMap[key] || key;
      newRow[mappedKey] = row[key];
    }
    return newRow;
  });

  // Save to cache
  saveCachedData(cacheKey, mapped);

  return mapped;
}

if (process.argv[1] === __filename) {
  (async () => {
    try {
      const outputFile = path.join(process.cwd(), 'tmp', 'range-data-output.json');

      const rangeData = await getDataRange(await fetchXlsxData4(), {
        fromNik: '3578106311200003',
        fromNama: 'NI NYOMAN ANINDYA MAHESWARI',
        toNik: '3578101502250001',
        toNama: 'MUHAMMAD NATHAN ALFATIR',
        outputFile
      });

      logLine(`\nSuccessfully extracted ${rangeData.length} rows`);

      const actualDatas = [
        { index: 0, 'TGL LAHIR': '23/11/2020', NAMA: 'NI NYOMAN ANINDYA MAHESWARI', NIK: '3578106311200003' },
        {
          index: 10,
          'TGL LAHIR': moment('2022-05-10', 'YYYY-MM-DD').format('DD/MM/YYYY'),
          NAMA: 'SADDAM AQSABYAN',
          NIK: '3578101005220004'
        },
        {
          NIK: '3578100610230010',
          NAMA: 'SEO EVELYN NABUD',
          'TGL LAHIR': moment('2023-10-06', 'YYYY-MM-DD').format('DD/MM/YYYY')
        }
      ];

      const totalRows = rangeData.length;
      let currentRow = 0;

      while (rangeData.length > 0) {
        const data = rangeData.shift();
        if (!data) continue;
        logInline(`Processing row ${currentRow} of ${totalRows}`);

        const actualData = actualDatas.find(
          (item) =>
            item.index === currentRow ||
            (item.NAMA && data.NAMA && item.NAMA.trim().toLowerCase() === data.NAMA.trim().toLowerCase()) ||
            (item.NIK && data.NIK && getNumbersOnly(item.NIK) === getNumbersOnly(data.NIK))
        );

        if (actualData) {
          const get = await fixData(data);
          logLine(
            `\nRow ${currentRow}:\n\tTGL LAHIR (fixed): ${get['TGL LAHIR']} | Expected: ${actualData['TGL LAHIR']} | Match: ${get['TGL LAHIR'] === actualData['TGL LAHIR']}\n\tNAMA: ${get['NAMA']} | Expected: ${actualData['NAMA']} | Match: ${get['NAMA'] === actualData['NAMA']}`
          );
        }

        currentRow++;
      }

      logLine(`\nProcessing completed. Processed ${currentRow} rows total.`);

      // force exit after processing
      process.exit(0);
    } catch (error) {
      logLine(error);
    }
  })().catch(logLine);
}
