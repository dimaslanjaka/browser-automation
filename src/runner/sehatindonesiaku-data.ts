import 'dotenv/config.js';
import fs from 'fs-extra';
import path from 'upath';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';
import { downloadSheets } from '../utils/googleSheet.js';

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
 * Parse the 'Format Full' sheet from an XLSX file and return an array of data objects.
 *
 * Each row is mapped to a partial DataItem, with columns mapped as follows:
 * - NIK, Nama, Tanggal Lahir (parsed from NIK if possible), Jenis Kelamin, Nomor WhatsApp, Pekerjaan, Provinsi, Alamat.
 * - Additional columns are included as dynamic keys (e.g., 'Column 9').
 *
 * @param filePath - Path to the XLSX file. Defaults to the local sehatindonesiaku.xlsx file.
 * @returns Promise resolving to an array of partial DataItem objects.
 * @throws If the 'Format Full' sheet is not found in the file.
 */
export async function parseXlsxFile(filePath = xlsxFile) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = 'Format Full';
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet '${sheetName}' not found in file: ${filePath}`);
  }
  // Parse from row 7 (index 6), no header
  const data: any[] = xlsx.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    range: 6 // 0-based, so 6 = row 7 as first data row
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
      obj[`Column ${index + 1}`] = row[index]; // Use dynamic keys for each column
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
  console.log(result[0]);
  return result;
}

(async () => {
  const spreadsheetId = process.env.KEMKES_SPREADSHEET_ID;
  if (!spreadsheetId) {
    console.error('KEMKES_SPREADSHEET_ID environment variable is not set.');
    process.exit(1);
  }
  const downloadResult = await downloadSheets(spreadsheetId);
  const result = await parseXlsxFile(downloadResult.xlsxFilePath);
  const outPath = path.join(__dirname, 'sehatindonesiaku-data.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`Parsed XLSX data (Format Full) written to: ${outPath}`);
})();
