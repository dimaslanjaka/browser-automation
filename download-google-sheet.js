import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs-extra';
import { google } from 'googleapis';
import minimist from 'minimist';
import path from 'upath';
import { URL, URLSearchParams } from 'url';
import xlsx from 'xlsx';
import { authorize } from './src/utils/googleClient.js';

// Load environment variables
dotenv.config();

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const CACHE_DIR = path.join(process.cwd(), '.cache', 'sheets');

/**
 * Downloads a Google Spreadsheet as XLSX and CSV files using the Sheets and Drive APIs.
 *
 * @param {string} spreadsheetId - The ID of the Google Spreadsheet.
 * @param {import('google-auth-library').OAuth2Client} auth - The authenticated OAuth2 client.
 * @returns {Promise<{ xlsxFilePath: string, csvFiles: string[] }>} Paths to the saved XLSX and CSV files.
 */
async function downloadSheetsApi(spreadsheetId, auth) {
  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  // Ensure output folder exists
  fs.ensureDirSync(CACHE_DIR);

  // Fetch spreadsheet metadata
  const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
  const spreadsheetUrl = sheetMeta.data.spreadsheetUrl;
  const sheetsList = sheetMeta.data.sheets;

  const metaFilePath = path.join(CACHE_DIR, `spreadsheet-${spreadsheetId}.meta.json`);
  let xlsxFilePath = path.join(CACHE_DIR, `spreadsheet-${spreadsheetId}.xlsx`);

  // Try fetching Drive file metadata
  let fileMeta = null;
  try {
    fileMeta = await drive.files.get({ fileId: spreadsheetId, fields: '*' });
  } catch (err) {
    console.warn('Failed to fetch Drive metadata:', err.message || err);
  }

  // Check cache using md5Checksum or modifiedTime
  let shouldDownload = true;
  if (fileMeta && fs.existsSync(xlsxFilePath) && fs.existsSync(metaFilePath)) {
    try {
      const cachedMeta = JSON.parse(fs.readFileSync(metaFilePath, 'utf-8'));
      const remoteChecksum = fileMeta.data.md5Checksum || fileMeta.data.modifiedTime;
      const cachedChecksum = cachedMeta.md5Checksum || cachedMeta.modifiedTime;
      if (remoteChecksum && cachedChecksum && remoteChecksum === cachedChecksum) {
        console.log('[api] XLSX file is up-to-date, skipping download.');
        shouldDownload = false;
      }
    } catch {
      // ignore parse errors
    }
  }

  if (shouldDownload) {
    try {
      const xlsxRes = await drive.files.export(
        {
          fileId: spreadsheetId,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        },
        { responseType: 'stream' }
      );
      const xlsxWriter = fs.createWriteStream(xlsxFilePath);
      xlsxRes.data.pipe(xlsxWriter);
      await new Promise((resolve, reject) => {
        xlsxWriter.on('finish', resolve);
        xlsxWriter.on('error', reject);
      });
      console.log(`Saved full spreadsheet as XLSX to ${xlsxFilePath}`);

      // Save metadata
      fs.writeFileSync(
        metaFilePath,
        JSON.stringify(
          {
            md5Checksum: fileMeta?.data?.md5Checksum,
            modifiedTime: fileMeta?.data?.modifiedTime
          },
          null,
          2
        ),
        'utf-8'
      );
    } catch {
      console.warn('Drive export failed, falling back to public export.');
      return downloadSheetsFallback(spreadsheetId);
    }
  }

  // Download each sheet as CSV
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

  return { xlsxFilePath, csvFiles };
}

/**
 * Fallback method to download a Google Spreadsheet as XLSX and convert to CSV using the public export URL.
 *
 * @param {string} spreadsheetId - The ID of the Google Spreadsheet.
 * @returns {Promise<{ xlsxFilePath: string|null, csvFiles: string[] }>} Paths to the saved XLSX and CSV files, or null if failed.
 */
async function downloadSheetsFallback(spreadsheetId) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const xlsxFilePath = path.join(CACHE_DIR, `spreadsheet-pub-${spreadsheetId}.xlsx`);

  try {
    const publicUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx&id=${spreadsheetId}`;
    console.log(`Downloading via public export URL: ${publicUrl}`);

    const response = await axios.get(publicUrl, { responseType: 'stream' });
    const xlsxWriter = fs.createWriteStream(xlsxFilePath);
    response.data.pipe(xlsxWriter);

    await new Promise((resolve, reject) => {
      xlsxWriter.on('finish', resolve);
      xlsxWriter.on('error', reject);
    });

    console.log(`Saved spreadsheet via public export as XLSX to ${xlsxFilePath}`);

    // Parse XLSX to CSV
    const workbook = xlsx.readFile(xlsxFilePath);
    const csvFiles = [];
    workbook.SheetNames.forEach((sheetName) => {
      const csv = xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName]);
      const csvFilePath = path.join(CACHE_DIR, `sheet-${sheetName.replace(/[^\w\d-]/g, '_')}.csv`);
      fs.writeFileSync(csvFilePath, csv, 'utf-8');
      csvFiles.push(csvFilePath);
      console.log(`Parsed and saved sheet '${sheetName}' as CSV to ${csvFilePath}`);
    });

    return { xlsxFilePath, csvFiles };
  } catch (err) {
    console.error('Failed public fallback download:', err.message || err);
    return { xlsxFilePath: null, csvFiles: [] };
  }
}

/**
 * Main wrapper to download a Google Spreadsheet as XLSX and CSV, using API or fallback if needed.
 *
 * @param {string} [spreadsheetId=SPREADSHEET_ID] - The ID of the Google Spreadsheet.
 * @returns {Promise<{ xlsxFilePath: string|null, csvFiles: string[] }>} Paths to the saved XLSX and CSV files, or null if failed.
 */
export async function downloadSheets(spreadsheetId = SPREADSHEET_ID) {
  try {
    const auth = await authorize();
    return await downloadSheetsApi(spreadsheetId, auth);
  } catch {
    console.warn('API download failed, using fallback.');
    return await downloadSheetsFallback(spreadsheetId);
  }
}

if (process.argv.some((arg) => arg.includes('download-google-sheet.js'))) {
  const args = minimist(process.argv.slice(2));
  const spreadsheetId = args.id || SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('SPREADSHEET_ID is missing. Please set it in your .env file or pass --id argument.');
  } else if (`${spreadsheetId}`.trim().length === 0) {
    throw new Error('SPREADSHEET_ID is provided but empty. Please provide a valid Google Spreadsheet ID.');
  }
  downloadSheets(spreadsheetId)
    .then((result) => {
      console.log('\n=== Result ===\n');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(console.error);
}
