import { authenticate } from '@google-cloud/local-auth';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';
import { OAuth2Client } from 'google-auth-library';
import { google } from 'googleapis';
import path from 'path';
import { URL, URLSearchParams } from 'url';

// Load environment variables
dotenv.config();

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

if (!SPREADSHEET_ID) {
  throw new Error('Missing SPREADSHEET_ID in .env file');
} else if (`${SPREADSHEET_ID}`.trim().length === 0) {
  throw new Error('SPREADSHEET_ID is empty');
}

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
  const sheetMeta = await sheets.spreadsheets.get({ spreadsheetId });
  const spreadsheetUrl = sheetMeta.data.spreadsheetUrl;
  const sheetsList = sheetMeta.data.sheets;

  // Ensure output folder exists
  const outDir = path.join(process.cwd(), '.cache', 'sheets');
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
  const csvFiles = [];

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
  downloadSheets()
    .then((result) => {
      console.log('\n=== Result ===\n');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(console.error);
}
