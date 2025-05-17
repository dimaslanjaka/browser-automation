import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { authenticate } from '@google-cloud/local-auth';
import axios from 'axios';
import { URL, URLSearchParams } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// ESM-friendly __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

if (!SPREADSHEET_ID) {
  throw new Error('Missing SPREADSHEET_ID in .env file');
} else if (`${SPREADSHEET_ID}`.trim().length === 0) {
  throw new Error('SPREADSHEET_ID is empty');
}

const CREDENTIALS_PATH = path.join(process.cwd(), '.cache', 'credentials.json');

async function authorize() {
  const auth = await authenticate({
    keyfilePath: CREDENTIALS_PATH,
    scopes: SCOPES
  });
  return auth;
}

async function downloadSheets() {
  const auth = await authorize();
  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  // Get sheet metadata
  const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const spreadsheetUrl = sheetMeta.data.spreadsheetUrl;
  const sheetsList = sheetMeta.data.sheets;

  // Ensure output folder exists
  const outDir = path.join(process.cwd(), '.cache');
  fs.mkdirSync(outDir, { recursive: true });

  // Download XLSX (whole spreadsheet)
  const xlsxFilePath = path.join(outDir, `spreadsheet-${SPREADSHEET_ID}.xlsx`);
  const xlsxRes = await drive.files.export(
    {
      fileId: SPREADSHEET_ID,
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

  // Download each sheet as CSV
  const parsedUrl = new URL(spreadsheetUrl);
  parsedUrl.pathname = parsedUrl.pathname.replace(/\/edit$/, '/export');

  for (const sheet of sheetsList) {
    const sheetId = sheet.properties.sheetId;
    const sheetName = sheet.properties.title.replace(/[^\w\d-]/g, '_'); // sanitize

    const params = new URLSearchParams({
      id: SPREADSHEET_ID,
      format: 'csv',
      gid: sheetId
    });

    parsedUrl.search = params.toString();

    const csvRes = await axios.get(parsedUrl.toString(), {
      headers: {
        Authorization: `Bearer ${auth.credentials.access_token}`
      },
      responseType: 'stream'
    });

    const csvFilePath = path.join(outDir, `sheet-${sheetName}-${sheetId}.csv`);
    const csvWriter = fs.createWriteStream(csvFilePath);

    csvRes.data.pipe(csvWriter);

    await new Promise((resolve, reject) => {
      csvWriter.on('finish', resolve);
      csvWriter.on('error', reject);
    });

    console.log(`Saved sheet "${sheetName}" as CSV to ${csvFilePath}`);
  }
}

downloadSheets().catch(console.error);
