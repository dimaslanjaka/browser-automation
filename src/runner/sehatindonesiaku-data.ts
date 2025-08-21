import axios from 'axios';
import 'dotenv/config.js';
import fs from 'fs-extra';
import path from 'upath';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';

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
  nik: string;
  nama: string;
  nomor_wa: string;
  tanggal_lahir: string;
  jenis_kelamin: string;
  pekerjaan: string;
  provinsi: string;
  alamat: string;
  tanggal_pemeriksaan: string;
  /** Geocoding result */
  // resolved_address?: Awaited<ReturnType<typeof resolveAddress>>;
  [key: string]: any;
}

async function downloadSheets(spreadsheetId: string) {
  const CACHE_DIR = path.join(process.cwd(), '.cache', 'sheets');
  const xlsxFilePath = path.join(CACHE_DIR, `spreadsheet-pub-${spreadsheetId}.xlsx`);
  const xlsxMetadataPath = path.join(CACHE_DIR, `spreadsheet-pub-${spreadsheetId}.json`);
  const publicUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx&id=${spreadsheetId}`;
  fs.ensureDirSync(CACHE_DIR);

  type Metadata = {
    size?: number;
    csvFiles: string[];
    [key: string]: any;
  };
  let metadata: Metadata = {
    csvFiles: []
  };
  if (fs.existsSync(xlsxMetadataPath)) {
    try {
      metadata = JSON.parse(fs.readFileSync(xlsxMetadataPath, 'utf-8'));
      console.log(`Loaded existing metadata from ${xlsxMetadataPath}`);
    } catch (err) {
      console.error('Failed to parse existing metadata:', err.message || err);
    }
  }

  let shouldDownload = true;

  try {
    const response = await axios.head(publicUrl);
    const remoteMetadata: Partial<Metadata> = {
      size: response.headers['content-length'] || 0
    };
    console.log(`Remote size: ${remoteMetadata.size}, local size: ${metadata.size}`);
    if (fs.existsSync(xlsxFilePath) && metadata.size === remoteMetadata.size) {
      shouldDownload = false;
    } else {
      // Replace existing metadata with remote data
      metadata = {
        ...metadata,
        ...remoteMetadata
      };
    }
  } catch (err) {
    console.error('Failed to fetch metadata for public export URL:', err.message || err);
  }

  if (!shouldDownload) {
    console.log('Local file is up-to-date, skipping download.');
    return { xlsxFilePath, csvFiles: metadata.csvFiles };
  }

  try {
    console.log(`Downloading via public export URL: ${publicUrl}`);

    const response = await axios.get(publicUrl, { responseType: 'stream' });
    const xlsxWriter = fs.createWriteStream(xlsxFilePath);
    response.data.pipe(xlsxWriter);

    await new Promise((resolve, reject) => {
      xlsxWriter.on('finish', () => resolve(undefined));
      xlsxWriter.on('error', reject);
    });

    console.log(`Saved spreadsheet via public export as XLSX to ${xlsxFilePath}`);

    // Parse XLSX to CSV
    const workbook = xlsx.readFile(xlsxFilePath);
    const csvFiles = [];
    workbook.SheetNames.forEach((sheetName) => {
      const csv = xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName]);
      const csvFilePath = path.join(CACHE_DIR, `sheet-${sheetName.replace(/[^\w\d-]/g, '_')}.csv`);
      metadata.csvFiles.push(csvFilePath);
      fs.writeFileSync(csvFilePath, csv, 'utf-8');
      csvFiles.push(csvFilePath);
      console.log(`Parsed and saved sheet '${sheetName}' as CSV to ${csvFilePath}`);
    });

    // Save updated metadata
    fs.writeFileSync(xlsxMetadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
    console.log(`New spreadsheet metadata saved to ${xlsxMetadataPath}`);

    return { xlsxFilePath, csvFiles };
  } catch (err) {
    console.error('Failed public fallback download:', err.message || err);
    return { xlsxFilePath: null, csvFiles: [] };
  }
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
    const obj = {
      tanggal_pemeriksaan
    };
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
        // Tanggal Lahir (parse from NIK)
        const nik = row[0];
        let tgl = row[index];
        if (nik && typeof nik === 'string' && nik.length >= 12) {
          let day = parseInt(nik.substring(6, 8), 10);
          const month = parseInt(nik.substring(8, 10), 10);
          let year = parseInt(nik.substring(10, 12), 10);
          if (day > 40) day -= 40;
          year += year <= 24 ? 2000 : 1900;
          // Format as DD/MM/YYYY
          tgl = `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year.toString().padStart(4, '0')}`;
        }
        obj['tanggal_lahir'] = tgl;
        continue;
      } else if (index === 3) {
        // Jenis Kelamin / Gender
        obj['jenis_kelamin'] = row[index];
        continue;
      } else if (index === 4) {
        // Nomor WhatsApp (WA)
        obj['nomor_wa'] = '+62' + row[index];
        continue;
      } else if (index === 5) {
        // Pekerjaan
        obj['pekerjaan'] = row[index];
        continue;
      } else if (index === 6) {
        // Provinsi
        obj['provinsi'] = row[index];
        continue;
      } else if (index === 7) {
        // Alamat
        obj['alamat'] = row[index];
        continue;
      }
      obj[`Column ${index + 1}`] = row[index]; // Use dynamic keys for each column
    }
    // FIXME: Search actual address
    // try {
    //   const address = (obj['alamat'] || '') + ' ' + (obj['provinsi'] || '');
    //   obj['resolved_address'] = await resolveAddress(address);
    // } catch {
    //   //
    // }
    result.push(obj);
  }
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
