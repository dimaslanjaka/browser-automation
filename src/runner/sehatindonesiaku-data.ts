import 'dotenv/config.js';
import fs from 'fs-extra';
import path from 'upath';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';
import { downloadSheets } from '../utils/googleSheet.js';
import oboe from 'oboe';
import { SQLiteLogDatabase } from '../database/SQLiteLogDatabase.js';
import minimist from 'minimist';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const xlsxFile = path.join(__dirname, 'sehatindonesiaku.xlsx');
const tanggal_pemeriksaan = '21/08/2025';

/**
 * Select a date in a Vue-based mx-datepicker component by simulating user interaction.
 * Handles year, month, and day navigation robustly for DD/MM/YYYY format.
 * @param page Puppeteer page instance
 * @param item Data item containing tanggal_lahir in DD/MM/YYYY
 */
export interface DataItem {
  nik: string | null;
  nama: string | null;
  nomor_wa: string | null;
  tanggal_lahir: string | null;
  jenis_kelamin: string | null;
  pekerjaan: string | null;
  provinsi: string | null;
  alamat: string | null;
  tanggal_pemeriksaan: string | null;
  tinggi_badan?: number | null;
  berat_badan?: number | null;
  /** Geocoding result */
  // resolved_address?: Awaited<ReturnType<typeof resolveAddress>>;
  [key: string]: any;
}

/**
 * Stream a JSON array file and process each item as it comes.
 * @param filePath Path to the JSON file (array of objects)
 * @param onItem Callback called for each DataItem
 * @returns Promise that resolves when streaming is done
 */
export function readSehatIndonesiakuData(filePath: string, onItem: (item: DataItem) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(filePath, { encoding: 'utf8' });

    oboe(readStream)
      .node('![*]', (item: DataItem) => {
        onItem(item);
        return oboe.drop; // prevent storing in memory
      })
      .done(() => resolve())
      .fail((err) => reject(err));
  });
}

/**
 * Stream a JSON array file and process each item sequentially using async callback.
 * @param filePath Path to the JSON file
 * @param onItem Async callback called for each DataItem
 */
export async function readSehatIndonesiakuDataAsync(
  filePath: string,
  onItem: (item: DataItem) => Promise<void>
): Promise<void> {
  const readStream = fs.createReadStream(filePath, { encoding: 'utf8' });

  const queue: Promise<void>[] = [];

  return new Promise((resolve, reject) => {
    oboe(readStream)
      .node('![*]', (item: DataItem) => {
        // Push a promise to the queue
        const p = (queue.length ? queue[queue.length - 1] : Promise.resolve()).then(() => onItem(item));
        queue.push(p);
        return oboe.drop;
      })
      .done(() => {
        // Wait until all queued promises are finished
        Promise.all(queue)
          .then(() => resolve())
          .catch((err) => reject(err));
      })
      .fail((err) => reject(err));
  });
}

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
        obj['nomor_wa'] = '+62' + row[index];
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
 * Download the Kemkes spreadsheet from Google Sheets, parse the 'Format Full' sheet,
 * and write the processed data as JSON to the cache directory.
 *
 * - Requires the KEMKES_SPREADSHEET_ID environment variable to be set.
 * - Downloads the spreadsheet, parses the XLSX, and saves the result as JSON.
 * - Output path: .cache/sheets/sehatindonesiaku-data.json (relative to project root)
 *
 * @param rangeIndex - 0-based row index to start parsing (default: 6, i.e., row 7)
 * @param rangeEndIndex - 0-based row index to end parsing (inclusive, optional)
 * @returns Resolves when the process is complete.
 */
export async function downloadAndProcessXlsx(rangeIndex = 6, rangeEndIndex: number = Number.MAX_SAFE_INTEGER) {
  const spreadsheetId = process.env.KEMKES_SPREADSHEET_ID;
  if (!spreadsheetId) {
    console.error('KEMKES_SPREADSHEET_ID environment variable is not set.');
    process.exit(1);
  }
  const downloadResult = await downloadSheets(spreadsheetId);
  const result = await parseXlsxFile(downloadResult.xlsxFilePath, rangeIndex, rangeEndIndex);
  fs.ensureDirSync(path.dirname(outPath));
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`Parsed XLSX data (Format Full) written to: ${outPath}`);
}

export const sehatindonesiakuDb = new SQLiteLogDatabase('sehatindonesiaku-kemkes');

if (process.argv.some((arg) => arg.includes('sehatindonesiaku-data'))) {
  (async () => {
    const args = minimist(process.argv.slice(2), {
      alias: { h: 'help' }
    });
    if (args.help) {
      console.log(`\nUsage: node sehatindonesiaku-data [--start <row>] [--end <row>] [--help|-h]\n`);
      console.log('  --start <row>   Start row index (default: 320)');
      console.log('  --end <row>     End row index (default: 500)');
      console.log('  --help, -h      Show this help message');
      process.exit(0);
    }
    const start = parseInt(args.start) || 320;
    let end: number;
    if (typeof args.end === 'string' && args.end.toLowerCase() === 'max') {
      end = Number.MAX_SAFE_INTEGER;
    } else {
      end = parseInt(args.end) || 500;
    }

    console.log(`Downloading and processing XLSX with range ${start}-${end}...`);
    // download excel and parse with range 320-500
    await downloadAndProcessXlsx(start, end);
  })();
}
