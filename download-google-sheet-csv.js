import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs-extra';
import { google } from 'googleapis';
import minimist from 'minimist';
import path from 'upath';
import { URL, URLSearchParams } from 'url';
import xlsx from 'xlsx';
import { authorize } from './src/utils/googleClient.js';
import moment from 'moment';
import 'moment/locale/id.js';
import { getDatesWithoutSundays } from './src/utils/date.js';
import { array_random } from 'sbg-utility';

dotenv.config({ quiet: true, override: true });

const CACHE_DIR = path.join(process.cwd(), '.cache', 'sheets');

/**
 * Download each sheet of a spreadsheet as CSV using an existing OAuth2 `auth` client.
 * Returns an array of CSV file paths.
 */
export async function downloadSheetsCsvWithAuth(spreadsheetId, auth) {
  const sheets = google.sheets({ version: 'v4', auth });

  fs.ensureDirSync(CACHE_DIR);

  const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
  const spreadsheetUrl = sheetMeta.data.spreadsheetUrl;
  const sheetsList = sheetMeta.data.sheets || [];

  const csvFiles = [];
  for (const sheet of sheetsList) {
    const sheetId = sheet.properties.sheetId;
    const sheetName = sheet.properties.title.replace(/[^\w\d-]/g, '_');
    const params = new URLSearchParams({
      id: spreadsheetId,
      format: 'csv',
      gid: sheetId
    });
    const parsedUrl = new URL(spreadsheetUrl);
    parsedUrl.pathname = parsedUrl.pathname.replace(/\/edit$/, '/export');
    parsedUrl.search = params.toString();

    const csvRes = await axios.get(parsedUrl.toString(), {
      headers: { Authorization: `Bearer ${auth.credentials.access_token}` },
      responseType: 'stream'
    });

    const csvFilePath = path.join(CACHE_DIR, `sheet-${sheetName}-${sheetId}.csv`);
    const csvWriter = fs.createWriteStream(csvFilePath);
    csvRes.data.pipe(csvWriter);

    await new Promise((resolve, reject) => {
      csvWriter.on('finish', () => {
        csvFiles.push(csvFilePath);
        resolve();
      });
      csvWriter.on('error', reject);
    });

    console.log(`Saved sheet "${sheetName}" as CSV to ${csvFilePath}`);
  }

  return csvFiles;
}

/**
 * Fallback: download public XLSX export and convert sheets to CSV.
 * Returns an array of CSV file paths.
 */
export async function downloadSheetsCsvFallback(spreadsheetId) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const xlsxFilePath = path.join(CACHE_DIR, `spreadsheet-pub-${spreadsheetId}.xlsx`);

  try {
    const publicUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx&id=${spreadsheetId}`;
    console.log(`Downloading spreadsheet via public export: ${publicUrl}`);

    const response = await axios.get(publicUrl, { responseType: 'stream' });
    const xlsxWriter = fs.createWriteStream(xlsxFilePath);
    response.data.pipe(xlsxWriter);

    await new Promise((resolve, reject) => {
      xlsxWriter.on('finish', resolve);
      xlsxWriter.on('error', reject);
    });

    console.log(`Saved spreadsheet as XLSX to ${xlsxFilePath}`);

    const workbook = xlsx.readFile(xlsxFilePath);
    const csvFiles = [];
    workbook.SheetNames.forEach((sheetName) => {
      const csv = xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName]);
      const safe = sheetName.replace(/[^\w\d-]/g, '_');
      const csvFilePath = path.join(CACHE_DIR, `sheet-${safe}.csv`);
      fs.writeFileSync(csvFilePath, csv, 'utf-8');
      csvFiles.push(csvFilePath);
      console.log(`Parsed and saved sheet '${sheetName}' as CSV to ${csvFilePath}`);
    });

    return csvFiles;
  } catch (err) {
    console.error('Failed public fallback CSV conversion:', err.message || err);
    return [];
  }
}

/**
 * Wrapper: try authorized CSV download, otherwise fallback.
 */
export async function downloadSheetsCsv(spreadsheetId) {
  try {
    const auth = await authorize();
    return await downloadSheetsCsvWithAuth(spreadsheetId, auth);
  } catch (err) {
    console.warn('CSV API download failed, using public fallback.');
    return await downloadSheetsCsvFallback(spreadsheetId);
  }
}

// Helpers: split/join CSV respecting quotes
function splitCsv(line, delim) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === delim && !inQuotes) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function joinCsv(fields, delim) {
  return fields
    .map((f) => {
      if (f == null) return '';
      const s = String(f);
      if (s.includes('"')) return '"' + s.replace(/"/g, '""') + '"';
      if (s.includes(delim) || s.includes('\n') || s.includes('\r') || s.includes(',')) return '"' + s + '"';
      return s;
    })
    .join(delim);
}

export function ensureTanggalEntry(csvFilePath) {
  if (!fs.existsSync(csvFilePath)) throw new Error(`CSV file not found: ${csvFilePath}`);
  let content = fs.readFileSync(csvFilePath, 'utf-8');
  content = content.replace(/\r\n/g, '\n');
  const lines = content.split('\n');
  if (lines.length === 0) return csvFilePath;

  const headerLine = lines[0];
  const delimiter = headerLine.includes(',') || !headerLine.includes(';') ? ',' : ';';
  const headers = splitCsv(headerLine, delimiter).map((h) => h.trim().replace(/^"|"$/g, ''));
  const hasTanggal = headers.some((h) => h.toLowerCase() === 'tanggal entry');
  if (hasTanggal) return csvFilePath;

  moment.locale('id');
  const monthName = moment().format('MMMM').toUpperCase();
  const currentYear = moment().year();
  const monthDates = getDatesWithoutSundays(monthName, currentYear, 'DD/MM/YYYY', true);

  const newLines = [];
  const newHeaderFields = ['TANGGAL ENTRY', ...splitCsv(headerLine, delimiter)];
  newLines.push(joinCsv(newHeaderFields, delimiter));

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (row == null || row.trim() === '') {
      newLines.push(row);
      continue;
    }
    const fields = splitCsv(row, delimiter).map((f) => (f == null ? '' : f));

    const outFields = [array_random(monthDates), ...fields];
    newLines.push(joinCsv(outFields, delimiter));
  }

  fs.writeFileSync(csvFilePath, newLines.join('\n'), 'utf-8');
  return csvFilePath;
}

export function fillPetugasEntry(csvFilePath) {
  if (!fs.existsSync(csvFilePath)) throw new Error(`CSV file not found: ${csvFilePath}`);
  let content = fs.readFileSync(csvFilePath, 'utf-8');
  content = content.replace(/\r\n/g, '\n');
  const lines = content.split('\n');
  if (lines.length === 0) return csvFilePath;

  const headerLine = lines[0];
  const delimiter = headerLine.includes(',') || !headerLine.includes(';') ? ',' : ';';
  const headers = splitCsv(headerLine, delimiter).map((h) => h.trim().replace(/^"|"$/g, ''));
  const petugasIndex = headers.findIndex((h) => h.toLowerCase() === 'petugas entry');
  if (petugasIndex === -1) return csvFilePath;

  const newLines = [headerLine];
  let lastPetugas = null;
  for (let i = 1; i < lines.length; i++) {
    const row = lines[i];
    if (row == null || row.trim() === '') {
      newLines.push(row);
      continue;
    }
    const fields = splitCsv(row, delimiter).map((f) => (f == null ? '' : f));
    if (fields.length <= petugasIndex) {
      while (fields.length <= petugasIndex) fields.push('');
    }
    const val = fields[petugasIndex].trim();
    if (!val) {
      if (lastPetugas) fields[petugasIndex] = lastPetugas;
    } else {
      lastPetugas = val;
    }
    newLines.push(joinCsv(fields, delimiter));
  }

  fs.writeFileSync(csvFilePath, newLines.join('\n'), 'utf-8');
  return csvFilePath;
}

export function fixCsv(csvFilePath) {
  // compatibility wrapper
  // normalize TGL LAHIR header first
  normalizeTglLahirHeader(csvFilePath);
  ensureTanggalEntry(csvFilePath);
  fillPetugasEntry(csvFilePath);
  console.log(`Fixed CSV: ${csvFilePath}`);
  return csvFilePath;
}

export function normalizeTglLahirHeader(csvFilePath) {
  if (!fs.existsSync(csvFilePath)) throw new Error(`CSV file not found: ${csvFilePath}`);
  let content = fs.readFileSync(csvFilePath, 'utf-8');
  content = content.replace(/\r\n/g, '\n');
  const lines = content.split('\n');
  if (lines.length === 0) return csvFilePath;

  const headerLine = lines[0];
  const delimiter = headerLine.includes(',') || !headerLine.includes(';') ? ',' : ';';
  const fields = splitCsv(headerLine, delimiter);
  let changed = false;

  const mapped = fields.map((f) => {
    const trimmed = (f || '').trim().replace(/^"|"$/g, '');
    if (/^ttl$/i.test(trimmed) || /^tanggal\s*lahir$/i.test(trimmed)) {
      changed = true;
      return 'TGL LAHIR';
    }
    return f;
  });

  if (!changed) return csvFilePath;

  const newHeader = joinCsv(mapped, delimiter);
  lines[0] = newHeader;
  fs.writeFileSync(csvFilePath, lines.join('\n'), 'utf-8');
  console.log(`Normalized TGL LAHIR header in ${csvFilePath}`);
  return csvFilePath;
}

// CLI
if (process.argv.some((arg) => arg.includes('download-google-sheet-csv.js'))) {
  const args = minimist(process.argv.slice(2));
  const spreadsheetId = args.id || process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID is missing. Please set it in your .env file or pass --id argument.');
  }
  downloadSheetsCsv(spreadsheetId)
    .then((csvFiles) => {
      console.log('\n=== CSV Files ===\n');
      console.log(JSON.stringify(csvFiles, null, 2));
      // Use the downloader-returned `csvFiles` directly and check one sibling variant
      try {
        const toFix = new Set();
        for (const filePath of csvFiles) {
          const name = path.basename(filePath);
          const full = path.join(CACHE_DIR, name);
          toFix.add(full);

          // also consider the version without a trailing -<gid>
          const withoutGid = name.replace(/-\d+\.csv$/, '.csv');
          if (withoutGid !== name) {
            const alt = path.join(CACHE_DIR, withoutGid);
            if (fs.existsSync(alt)) toFix.add(alt);
          }
        }

        for (const file of toFix) {
          try {
            fixCsv(file);
          } catch (err) {
            console.error(`Failed to fix CSV file ${file}:`, err.message || err);
          }
        }
      } catch (err) {
        console.error('Failed fixing CSV files:', err.message || err);
      }
    })
    .catch(console.error);
}
