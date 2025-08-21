import { authenticate } from '@google-cloud/local-auth';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs-extra';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import path from 'upath';
import { URL, URLSearchParams } from 'url';
import minimist from 'minimist';
import xlsx from 'xlsx';

// Load environment variables
dotenv.config();

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const CREDENTIALS_PATH = path.join(process.cwd(), '.cache', 'credentials.json');
const TOKEN_PATH = path.join(process.cwd(), '.cache', 'token.json');
const CACHE_DIR = path.join(process.cwd(), '.cache', 'sheets');

/**
 * Saves the OAuth2 credentials (access token, refresh token, etc.) to a local file.
 *
 * @param {import('google-auth-library').OAuth2Client} auth - The authenticated OAuth2 client.
 * @param {import('google-auth-library').Credentials} customCredentials - Custom credentials to save.
 */
function saveToken(auth, customCredentials = null) {
  try {
    // Ensure the .cache directory exists
    const tokenDir = path.dirname(TOKEN_PATH);
    fs.ensureDirSync(tokenDir);

    fs.writeFileSync(
      TOKEN_PATH,
      JSON.stringify(customCredentials ? customCredentials : auth.credentials, null, 2),
      'utf-8'
    );
  } catch (err) {
    console.error('Failed to save token:', err);
  }
}

/**
 * Loads an OAuth2Client using saved credentials and refresh tokens.
 *
 * @async
 * @returns {Promise<OAuth2Client|null>} An authenticated OAuth2Client instance with refreshed access token if needed, or null if no token exists.
 */
async function getClient() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const { client_id, client_secret, redirect_uris } = credentials.installed;

  const oAuth2Client = new OAuth2Client(client_id, client_secret, redirect_uris[0]);

  // Check if token file exists
  if (!fs.existsSync(TOKEN_PATH)) {
    console.log('Token file does not exist, will need fresh authentication');
    return null;
  }

  try {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    oAuth2Client.setCredentials(token);

    // Optional: Refresh token if expired
    const newToken = await oAuth2Client.getAccessToken();
    if (newToken?.token !== token.access_token) {
      saveToken(oAuth2Client);
      console.log('Updated access token saved to', TOKEN_PATH);
    }

    return oAuth2Client;
  } catch (err) {
    console.error('Error loading token:', err.message);
    return null; // Return null instead of throwing
  }
}

/**
 * Obtains an authenticated OAuth2 client, reusing or refreshing tokens if available.
 *
 * @returns {Promise<import('google-auth-library').OAuth2Client>}
 */
async function authorize() {
  console.log('Authorizing with Google Sheets API...');

  let auth;

  // Try to use existing saved token first
  auth = await getClient();

  if (auth) {
    console.log('Using existing saved token.');
  } else {
    // If no saved token or error loading it, perform fresh authentication
    console.log('No valid saved token found. Performing fresh authentication...');
    auth = await authenticate({
      keyfilePath: CREDENTIALS_PATH,
      scopes: SCOPES
    });

    // Save the new token immediately after authentication
    saveToken(auth);
    console.log('New token saved to', TOKEN_PATH);
  }

  // Set up token refresh handler for future token updates
  auth.on('tokens', (tokens) => {
    const combined = { ...auth.credentials, ...tokens };
    try {
      saveToken(auth, combined);
      console.log('Token updated and saved to', TOKEN_PATH);
    } catch (err) {
      console.error('Failed to write updated token:', err);
    }
  });

  // Check and refresh token if expired
  const { expiry_date = false } = auth.credentials;
  const isExpired = !expiry_date || expiry_date <= Date.now();
  console.log(`Token expiry date: ${expiry_date ? new Date(expiry_date).toISOString() : 'N/A'}`);
  console.log(`Token is ${isExpired ? 'expired' : 'valid'}.`);

  if (isExpired) {
    try {
      console.log('Refreshing expired access token...');
      const newToken = await auth.refreshAccessToken();
      auth.setCredentials(newToken.credentials);
      saveToken(auth);
      console.log('Access token refreshed and saved.');
    } catch (err) {
      console.error('Failed to refresh access token:', err);
      // If refresh fails, might need fresh authentication
      throw err;
    }
  } else {
    console.log('Cached access token is still valid.');
  }

  return auth;
}

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
