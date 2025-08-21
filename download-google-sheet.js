import { authenticate } from '@google-cloud/local-auth';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import path from 'path';
import { URL, URLSearchParams } from 'url';
import minimist from 'minimist';
import xlsx from 'xlsx';

// Load environment variables
dotenv.config();

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

const CREDENTIALS_PATH = path.join(process.cwd(), '.cache', 'credentials.json');
const TOKEN_PATH = path.join(process.cwd(), '.cache', 'token.json');

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
    if (!fs.existsSync(tokenDir)) {
      fs.mkdirSync(tokenDir, { recursive: true });
    }

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
 * @function getClient
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
 * Downloads all sheets from a Google Spreadsheet as CSV files and the entire spreadsheet as XLSX.
 *
 * - Downloads the full spreadsheet as an XLSX file to `.cache/sheets/`.
 * - Downloads each individual sheet as a CSV file to `.cache/sheets/`.
 *
 * @async
 * @function downloadSheets
 * @param {string} [spreadsheetId=SPREADSHEET_ID] - The ID of the Google Spreadsheet to download. Defaults to the value from the environment variable `SPREADSHEET_ID`.
 * @returns {Promise<{xlsxFilePath: string, csvFiles: string[]}>} Resolves with the XLSX file path and an array of CSV file paths.
 */
export async function downloadSheets(spreadsheetId = SPREADSHEET_ID) {
  const auth = await authorize();
  const sheets = google.sheets({ version: 'v4', auth });
  const drive = google.drive({ version: 'v3', auth });

  // Get sheet metadata
  let sheetMeta, spreadsheetUrl, sheetsList;
  try {
    sheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
    spreadsheetUrl = sheetMeta.data.spreadsheetUrl;
    sheetsList = sheetMeta.data.sheets;
  } catch (metaErr) {
    // Always print error after result, not before
    let errorMsg = 'Failed to fetch spreadsheet metadata: ' + (metaErr.message || metaErr);
    // fallback: try public export for ANY spreadsheetId (like x.cjs)
    const outDir = path.join(process.cwd(), '.cache', 'sheets');
    fs.mkdirSync(outDir, { recursive: true });
    try {
      const publicUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx&id=${spreadsheetId}`;
      console.log(`Attempting to download spreadsheet via public export URL (metadata fallback): ${publicUrl}`);
      const response = await axios.get(publicUrl, { responseType: 'stream' });
      const xlsxFilePathLocal = path.join(outDir, `spreadsheet-pub-${spreadsheetId}.xlsx`);
      const xlsxWriter = fs.createWriteStream(xlsxFilePathLocal);
      response.data.pipe(xlsxWriter);
      await new Promise((resolve, reject) => {
        xlsxWriter.on('finish', resolve);
        xlsxWriter.on('error', reject);
      });
      console.log(`Saved spreadsheet via public export as XLSX to ${xlsxFilePathLocal}`);

      // Parse all sheets as CSV and save to files
      const workbook = xlsx.readFile(xlsxFilePathLocal);
      const csvFiles = [];
      workbook.SheetNames.forEach((sheetName) => {
        const csv = xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName]);
        const csvFilePath = path.join(outDir, `sheet-${sheetName.replace(/[^\w\d-]/g, '_')}.csv`);
        fs.writeFileSync(csvFilePath, csv, 'utf-8');
        csvFiles.push(csvFilePath);
        console.log(`Parsed and saved sheet '${sheetName}' as CSV to ${csvFilePath}`);
      });

      // Print result first, then error if any
      const result = { xlsxFilePath: xlsxFilePathLocal, csvFiles };
      console.log('\n=== Result ===\n');
      console.log(JSON.stringify(result, null, 2));
      if (errorMsg) console.error(errorMsg);
      return result;
    } catch (pubErr) {
      const result = { xlsxFilePath: null, csvFiles: [] };
      console.log('\n=== Result ===\n');
      console.log(JSON.stringify(result, null, 2));
      console.error(
        'Failed to download spreadsheet via public export URL (metadata fallback):',
        pubErr.message || pubErr
      );
      if (errorMsg) console.error(errorMsg);
      return result;
    }
  }

  // Ensure output folder exists
  const outDir = path.join(process.cwd(), '.cache', 'sheets');
  fs.mkdirSync(outDir, { recursive: true });

  // Always fetch and print file metadata first
  let xlsxFilePath = null;
  let fileMeta = null;
  try {
    fileMeta = await drive.files.get({ fileId: spreadsheetId, fields: '*' });
    console.log('Drive file metadata:', JSON.stringify(fileMeta.data, null, 2));
  } catch (metaErr) {
    console.error('Failed to fetch Drive file metadata:', metaErr.message || metaErr);
  }

  if (fileMeta && fileMeta.data && fileMeta.data.mimeType === 'application/vnd.google-apps.spreadsheet') {
    xlsxFilePath = path.join(outDir, `spreadsheet-${spreadsheetId}.xlsx`);
    try {
      // Try Drive export and fallback in a single try/catch
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
      } catch (exportErr) {
        console.error('Failed to export spreadsheet as XLSX (Drive export error):', exportErr.message || exportErr);
        xlsxFilePath = null;
        // Try public export URL (for published sheets)
        let exportId = spreadsheetId;
        const publicUrl = `https://docs.google.com/spreadsheets/d/${exportId}/export?format=xlsx&id=${exportId}`;
        console.log(`Attempting to download spreadsheet via public export URL: ${publicUrl}`);
        try {
          const response = await axios.get(publicUrl, { responseType: 'stream' });
          const xlsxWriter2 = fs.createWriteStream(path.join(outDir, `spreadsheet-pub-${exportId}.xlsx`));
          response.data.pipe(xlsxWriter2);
          await new Promise((resolve, reject) => {
            xlsxWriter2.on('finish', resolve);
            xlsxWriter2.on('error', reject);
          });
          xlsxFilePath = path.join(outDir, `spreadsheet-pub-${exportId}.xlsx`);
          console.log(`Saved spreadsheet via public export as XLSX to ${xlsxFilePath}`);
        } catch (pubErr) {
          console.error('Failed to download spreadsheet via public export URL:', pubErr.message || pubErr);
          xlsxFilePath = null;
        }
      }
    } catch (allErr) {
      // Catch any unexpected error in the export logic
      console.error('Unexpected error during XLSX export attempts:', allErr.message || allErr);
      xlsxFilePath = null;
    }
  } else if (fileMeta && fileMeta.data) {
    console.error(
      `File with ID ${spreadsheetId} is not a Google Sheet (found mimeType: ${fileMeta.data.mimeType}). Cannot export as XLSX.`
    );
    xlsxFilePath = null;
  }

  // Download each sheet as CSV
  const parsedUrl = new URL(spreadsheetUrl);
  parsedUrl.pathname = parsedUrl.pathname.replace(/\/edit$/, '/export');
  const csvFiles = [];

  for (const sheet of sheetsList) {
    const sheetId = sheet.properties.sheetId;
    const sheetName = sheet.properties.title.replace(/[^\w\d-]/g, '_'); // sanitize

    const params = new URLSearchParams({
      id: spreadsheetId,
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
      csvWriter.on('finish', () => {
        csvFiles.push(csvFilePath);
        resolve(undefined);
      });
      csvWriter.on('error', reject);
    });

    console.log(`Saved sheet "${sheetName}" as CSV to ${csvFilePath}`);
  }

  return {
    xlsxFilePath,
    csvFiles
  };
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
