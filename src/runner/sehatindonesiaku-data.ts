import 'dotenv/config.js';
import fs from 'fs-extra';
import minimist from 'minimist';
import { normalizePathUnix } from 'sbg-utility';
import SharedPreferences from 'sbg-utility/dist/utils/SharedPreferences';
import path from 'upath';
import xlsx from 'xlsx';
import { LogDatabase } from '../database/LogDatabase.js';
import { downloadSheets } from '../utils/googleSheet.js';
import { DataItem } from './types.js';

let sehatindonesiakuDb: LogDatabase;
export function getSehatIndonesiaKuDb() {
  if (!sehatindonesiakuDb) {
    console.log('[DB] Creating sehatindonesiaku-kemkes pool (connectionLimit: 10)');
    sehatindonesiakuDb = new LogDatabase('sehatindonesiaku-kemkes', {
      connectTimeout: 60000,
      connectionLimit: 10
    });
  }
  return sehatindonesiakuDb;
}
export function restartSehatIndonesiaKuDb() {
  if (sehatindonesiakuDb) {
    sehatindonesiakuDb
      .close()
      .then(() => {
        console.log('[DB] Closed sehatindonesiaku-kemkes pool');
      })
      .catch(() => {
        // Ignore close error
      });
  }
  console.log('[DB] Restarting sehatindonesiaku-kemkes pool (connectionLimit: 10)');
  sehatindonesiakuDb = new LogDatabase('sehatindonesiaku-kemkes', {
    connectTimeout: 60000,
    connectionLimit: 10
  });
  return sehatindonesiakuDb;
}

export const sehatindonesiakuPref = new SharedPreferences({ namespace: 'sehatindonesiaku-kemkes' });
const xlsxFile = path.join(process.cwd(), '.cache/sheets/sehatindonesiaku.xlsx');
const tanggal_pemeriksaan = sehatindonesiakuPref.getString('tanggal_pemeriksaan', '24/08/2025');

process.on('SIGINT', async () => {
  await sehatindonesiakuDb.close();
  console.log('[DB] Closed sehatindonesiaku-kemkes pool (SIGINT)');
  process.exit(0);
});
process.on('SIGTERM', async () => {
  await sehatindonesiakuDb.close();
  console.log('[DB] Closed sehatindonesiaku-kemkes pool (SIGTERM)');
  process.exit(0);
});
process.on('exit', () => {
  // Not async, but best effort
  sehatindonesiakuDb.close();
  console.log('[DB] Closed sehatindonesiaku-kemkes pool (exit)');
});

/**
 * Parse the 'Format Full' sheet from an XLSX file and return an array of data objects.
 *
 * Each row is mapped to a partial DataItem, with columns mapped as follows:
 * - NIK, Nama, Tanggal Lahir (parsed from NIK if possible), Jenis Kelamin, Nomor WhatsApp, Pekerjaan, Provinsi, Alamat.
 * - Additional columns are included as dynamic keys (e.g., 'Column 9').
 *
 * @param filePath - Path to the XLSX file. Defaults to the local sehatindonesiaku.xlsx file.
 * @param rangeIndex - 0-based row index to start parsing (default: 6, i.e., row 7)
 * @param rangeEndIndex - 0-based row index to end parsing (inclusive, optional)
 * @returns Promise resolving to an array of partial DataItem objects.
 * @throws If the 'Format Full' sheet is not found in the file.
 */
export async function parseXlsxFile(
  filePath = xlsxFile,
  rangeIndex = 6,
  rangeEndIndex: number = Number.MAX_SAFE_INTEGER
) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = 'Format Full';
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet '${sheetName}' not found in file: ${filePath}`);
  }
  // Parse from row 7 (index 6) by default, no header
  // Fix: Prevent infinite range if rangeEndIndex is too large
  let sheetToJsonRange: string | number = rangeIndex;
  const ref = sheet['!ref'];
  let maxRow = Number.MAX_SAFE_INTEGER;
  if (ref) {
    const [, endCell] = ref.split(':');
    maxRow = xlsx.utils.decode_cell(endCell).r;
  }
  // Clamp rangeEndIndex to maxRow
  const effectiveEndIndex = Math.min(rangeEndIndex, maxRow);
  if (typeof rangeEndIndex === 'number' && effectiveEndIndex >= rangeIndex) {
    if (ref) {
      const [, endCell] = ref.split(':');
      const startCell = xlsx.utils.encode_cell({ c: 0, r: rangeIndex });
      const endCol = xlsx.utils.decode_cell(endCell).c;
      const endCellStr = xlsx.utils.encode_cell({ c: endCol, r: effectiveEndIndex });
      sheetToJsonRange = `${startCell}:${endCellStr}`;
    }
  }
  const data: any[] = xlsx.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    range: sheetToJsonRange
  });
  const result: Partial<DataItem>[] = [];
  for (const row of data) {
    const obj: DataItem = {
      tanggal_pemeriksaan,
      nik: null,
      nama: null,
      nomor_wa: null,
      tanggal_lahir: null,
      jenis_kelamin: null,
      pekerjaan: null,
      provinsi: null,
      alamat: null
    };
    if (!row || row.length === 0) {
      continue; // Skip empty rows
    }
    for (let index = 0; index < row.length; index++) {
      if (index === 0) {
        // NIK
        obj['nik'] = row[index];
        continue;
      } else if (index === 1) {
        // Nama
        obj['nama'] = row[index];
        continue;
      } else if (index === 2) {
        // Tanggal Lahir
        let tgl_lahir = row[index];
        // Convert Excel date number to DD/MM/YYYY if needed
        if (typeof tgl_lahir === 'number') {
          const jsDate = new Date(Math.round((tgl_lahir - 25569) * 86400 * 1000));
          tgl_lahir = jsDate.toLocaleDateString('en-GB'); // DD/MM/YYYY
        }
        // console.log(`${obj['nama']} Tanggal Lahir: ${tgl_lahir}`);
        obj['tanggal_lahir'] = tgl_lahir;
        continue;
      } else if (index === 3) {
        // Jenis Kelamin / Gender
        obj['jenis_kelamin'] = row[index];
        continue;
      } else if (index === 4) {
        // Tanggal Pemeriksaan
        let tglPemeriksaan = row[index];
        // Convert Excel date number to DD/MM/YYYY if needed
        if (typeof tglPemeriksaan === 'number') {
          // Excel date number to JS date
          const jsDate = new Date(Math.round((tglPemeriksaan - 25569) * 86400 * 1000));
          tglPemeriksaan = jsDate.toLocaleDateString('en-GB'); // DD/MM/YYYY
        }
        obj['tanggal_pemeriksaan'] = tglPemeriksaan;
        // if (tglPemeriksaan) console.log(`${obj['nama']} Tanggal Pemeriksaan: ${tglPemeriksaan}`);
        continue;
      } else if (index === 5) {
        // Nomor WhatsApp (WA)
        if (row[index] && String(row[index]).startsWith('+62')) {
          obj['nomor_wa'] = String(row[index]);
        } else if (row[index] && String(row[index]).startsWith('0')) {
          obj['nomor_wa'] = '+62' + String(row[index]).substring(1);
        } else if (row[index] && String(row[index]).toString().trim() !== '') {
          obj['nomor_wa'] = '+62' + String(row[index]);
        }
        continue;
      } else if (index === 6) {
        // Pekerjaan
        obj['pekerjaan'] = row[index];
        continue;
      } else if (index === 7) {
        // Provinsi
        obj['provinsi'] = row[index];
        continue;
      } else if (index === 8) {
        // Alamat
        obj['alamat'] = row[index];
        continue;
      } else if (index === 44) {
        // Tinggi Badan
        obj['tinggi_badan'] = row[index];
        continue;
      } else if (index === 45) {
        // Berat Badan
        obj['berat_badan'] = row[index];
        continue;
      } else if (index === 46) {
        // Lingkar Perut
        obj['lingkar_perut'] = row[index];
        continue;
      } else if (index === 47) {
        // Sistolik
        obj['sistolik'] = row[index];
        continue;
      } else if (index === 48) {
        // Diastolik
        obj['diastolik'] = row[index];
        continue;
      } else if (index === 49) {
        // Gula Darah
        obj['gula_darah'] = row[index];
        continue;
      }
      obj[`Column ${index + 1}`] = row[index];
    }
    // FIXME: Search actual address
    // try {
    //   const address = (obj['alamat'] || '') + ' ' + (obj['provinsi'] || '');
    //   obj['resolved_address'] = await resolveAddress(address);
    // } catch {
    //   // Handle address resolution error
    // }
    result.push(obj);
  }
  // Remove undefined or null or spesific patterns values
  return (
    result
      .map((item) => {
        const cleanedItem: Partial<DataItem> = {};
        for (const key in item) {
          if (item[key] !== null && item[key] !== undefined && item[key] !== '+62null') {
            cleanedItem[key] = item[key];
          }
        }
        return cleanedItem;
      })
      // Filter out empty objects
      .filter((item) => Object.keys(item).length > 0)
  );
}

const outPath = path.join(process.cwd(), '.cache/sheets/sehatindonesiaku-data.json');
export { outPath as sehatindonesiakuDataPath };

/**
 * Downloads the Kemkes spreadsheet from Google Sheets, parses the "Format Full" sheet,
 * and writes the processed data as JSON to the cache directory.
 *
 * @param options - Options object
 * @param options.rangeIndex 0-based row index to start parsing (default: 6 → row 7)
 * @param options.rangeEndIndex 0-based row index to end parsing (inclusive, default: Number.MAX_SAFE_INTEGER)
 * @param options.spreadsheetId Optional Google Sheets spreadsheet ID. If not provided, falls back to `process.env.KEMKES_SPREADSHEET_ID`.
 * @param options.cache If true (default), use cache and skip download if up-to-date. If false, always download.
 * @returns Promise<void> Resolves when the process is complete.
 * @throws {Error} If neither a `spreadsheetId` argument nor the `KEMKES_SPREADSHEET_ID` environment variable is provided.
 */
export async function downloadAndProcessXlsx(
  options: {
    rangeIndex?: number;
    rangeEndIndex?: number;
    spreadsheetId?: string;
    cache?: boolean;
  } = {}
) {
  const { rangeIndex = 6, rangeEndIndex = Number.MAX_SAFE_INTEGER, spreadsheetId, cache = true } = options;
  const resolvedSpreadsheetId = spreadsheetId || process.env.KEMKES_SPREADSHEET_ID;

  if (!resolvedSpreadsheetId) {
    throw new Error(
      'Spreadsheet ID is required but not provided. ' +
        'Pass it explicitly as an argument, or set the KEMKES_SPREADSHEET_ID environment variable.'
    );
  }

  if (!cache) {
    console.log('Cache is disabled. Forcing download of the spreadsheet.');
  }

  const downloadResult = await downloadSheets(resolvedSpreadsheetId, !cache);
  const result = await parseXlsxFile(downloadResult.xlsxFilePath, rangeIndex, rangeEndIndex);
  fs.ensureDirSync(path.dirname(outPath));
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`Parsed XLSX data (Format Full) written to: ${outPath}`);
}

/**
 * Loads data from the Excel JSON file.
 *
 * Reads the processed data from the `.cache/sheets/sehatindonesiaku-data.json` file
 * and returns it as an array of DataItem objects.
 *
 * @returns Promise resolving to an array of DataItem objects loaded from the Excel JSON file.
 */
export async function getExcelData() {
  const rawData: DataItem[] = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
  return rawData;
}

/**
 * Loads data from the database and updates it with the latest Excel data if available.
 *
 * For each entry in the database, attempts to find a matching entry in the Excel data (by NIK).
 * If a match is found, updates the database entry with the Excel data and writes the updated entry back to the database.
 * Returns the resulting array of updated database entries.
 *
 * @returns Promise resolving to an array of DataItem objects, merged with the latest Excel data where available.
 */
export async function getDbData() {
  const dbData = (await sehatindonesiakuDb.getLogs<DataItem>()).filter((item) => item && item.data);
  // Fix update additional data from excel (when update)
  for (let i = dbData.length - 1; i >= 0; i--) {
    const item = dbData[i];
    const excelItem = (await getExcelData()).find((row) => row.nik === item.data.nik);
    if (excelItem) {
      console.log(`Updating data for NIK: ${item.data.nik}`);
      const newItem = { ...item, ...excelItem };
      dbData[i] = newItem;
      // Update database
      await sehatindonesiakuDb.addLog<DataItem>({
        id: item.data.nik,
        data: newItem,
        message: item.message
      });
    }
  }
  return dbData;
}

/**
 * Ensures a valid WhatsApp number exists in the Kemkes data item.
 *
 * If the `nomor_wa` field is missing or falsy, sets it to a default value.
 *
 * @param item - Partial DataItem object to fix.
 * @returns The updated Partial<DataItem> with a valid `nomor_wa` field.
 */
export function fixKemkesDataItem(item: Partial<DataItem>): Partial<DataItem> {
  if (!item.nomor_wa) {
    item.nomor_wa = '81316270797';
  }
  if (item.nomor_wa && String(item.nomor_wa).startsWith('0')) {
    item.nomor_wa = '+62' + String(item.nomor_wa).substring(1);
  } else if (item.nomor_wa && !String(item.nomor_wa).startsWith('+62')) {
    item.nomor_wa = '+62' + String(item.nomor_wa);
  }
  return item;
}

export function showHelp() {
  const [node, script] = process.argv;
  console.log(`Usage: ${normalizePathUnix(node)} ${normalizePathUnix(script)} [options]\n`);
  console.log('Options:');
  console.log('  --start <row>    Start row index (default: 320)');
  console.log('  --end <row>      End row index (default: 500)');
  console.log('  --cache          Use cache (default: true). If set to false, always download the spreadsheet.');
  console.log('  --nc, --no-cache Alias for --cache false (no cache, always download)');
  console.log('  --help, -h       Show this help message');
}

if (process.argv.some((arg) => /sehatindonesiaku-data\.(ts|mjs|js|cjs)$/.test(arg))) {
  (async () => {
    try {
      const cliArgs = minimist(process.argv.slice(2), {
        alias: { h: 'help', nc: 'cache' }, // `--nc` works as shorthand
        default: { cache: true } // cache enabled unless explicitly disabled
      });
      if (cliArgs.help) {
        showHelp();
        process.exit(0);
      }
      // Convert user input (Excel row numbers, 1-based) to 0-based indices for parsing
      const start = cliArgs.start !== undefined && !isNaN(parseInt(cliArgs.start)) ? parseInt(cliArgs.start) - 1 : 315;
      let end: number;
      if (typeof cliArgs.end === 'string' && cliArgs.end.toLowerCase() === 'max') {
        end = Number.MAX_SAFE_INTEGER;
      } else if (cliArgs.end !== undefined && !isNaN(parseInt(cliArgs.end))) {
        end = parseInt(cliArgs.end) - 1;
      } else {
        end = 1000;
      }
      if (end < start) {
        throw new Error(`Invalid range: end (${end + 1}) cannot be less than start (${start + 1})`);
      }

      const cache = cliArgs.cache !== false;

      console.log(`Downloading and processing XLSX with range ${start + 1}-${end + 1}...`);
      // download excel and parse with range 320-500
      await downloadAndProcessXlsx({ rangeIndex: start, rangeEndIndex: end, cache: cache });
    } finally {
      await sehatindonesiakuDb.close();
    }
  })();
}
