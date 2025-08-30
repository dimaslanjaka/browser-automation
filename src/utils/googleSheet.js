import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import xlsx from 'xlsx';
import { google } from 'googleapis';

/**
 * Download a Google Spreadsheet as XLSX and cache it locally, along with metadata and CSV exports for each sheet.
 *
 * - Checks remote file size and metadata to avoid unnecessary downloads (caching).
 * - Saves metadata (including file size and CSV file paths) to a JSON file in the cache directory.
 * - Converts each sheet in the XLSX to CSV and saves them in the cache directory.
 *
 * @param {string} spreadsheetId - The Google Spreadsheet ID to download.
 * @returns {Promise<{ xlsxFilePath: string, csvFiles: string[], xlsxMetadataPath: string }>} An object containing the XLSX file path and an array of CSV file paths.
 */
async function downloadSheets(spreadsheetId) {
  const CACHE_DIR = path.join(process.cwd(), '.cache', 'sheets');
  const xlsxFilePath = path.join(CACHE_DIR, `spreadsheet-pub-${spreadsheetId}.xlsx`);
  const xlsxMetadataPath = path.join(CACHE_DIR, `spreadsheet-pub-${spreadsheetId}.json`);
  const publicUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx&id=${spreadsheetId}`;
  fs.ensureDirSync(CACHE_DIR);

  /**
   * @typedef {Object} Metadata
   * @property {number} [size]
   * @property {string[]} csvFiles
   * @property {Object.<string, any>} [key: string]
   */

  /** @type {Metadata} */
  let metadata = {
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
    /** @type {Partial<Metadata>} */
    const remoteMetadata = {
      size: response.headers['content-length'] || 0
    };
    console.log(`Remote size: ${remoteMetadata.size}, local size: ${metadata.size}`);
    if (fs.existsSync(xlsxFilePath) && metadata.size == remoteMetadata.size) {
      shouldDownload = false;
    } else {
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

  console.log(`Downloading via public export URL: ${publicUrl}`);
  const response = await axios.get(publicUrl, { responseType: 'stream' });
  const xlsxWriter = fs.createWriteStream(xlsxFilePath);

  if (typeof response.data.pipe === 'function') {
    response.data.pipe(xlsxWriter);
    await new Promise((resolve, reject) => {
      xlsxWriter.on('finish', () => resolve());
      xlsxWriter.on('error', reject);
    });
  } else if (Buffer.isBuffer(response.data)) {
    fs.writeFileSync(xlsxFilePath, response.data);
  } else {
    // Try to write as binary if not a stream or buffer
    fs.writeFileSync(xlsxFilePath, response.data, 'binary');
  }

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

  return { xlsxFilePath, csvFiles, xlsxMetadataPath };
}

/**
 * Converts a color name to its corresponding RGB object with values in the range [0, 1].
 *
 * Supported color names: "red", "green", "blue", "yellow", "cyan", "magenta", "black", "white", "gray", "orange", "pink", "purple", "lightgreen", "lightblue".
 *
 * @param {string} colorName - The name of the color to convert.
 * @returns {{ red: number, green: number, blue: number }} The RGB representation of the color.
 * @throws {Error} If the color name is not supported.
 */
function colorNameToRgb(colorName) {
  const colors = {
    red: [1, 0, 0],
    green: [0, 1, 0],
    blue: [0, 0, 1],
    yellow: [1, 1, 0],
    cyan: [0, 1, 1],
    magenta: [1, 0, 1],
    black: [0, 0, 0],
    white: [1, 1, 1],
    gray: [0.5, 0.5, 0.5],
    orange: [1, 0.65, 0],
    pink: [1, 0.75, 0.8],
    purple: [0.5, 0, 0.5],
    lightgreen: [0.56, 0.93, 0.56],
    lightblue: [0.68, 0.85, 0.9]
  };

  const rgb = colors[colorName.toLowerCase()];
  if (!rgb) throw new Error(`Unsupported color name: ${colorName}`);

  return { red: rgb[0], green: rgb[1], blue: rgb[2] };
}

/**
 * Changes the background color of a specific row in a Google Sheet.
 *
 * @param {import('google-auth-library').OAuth2Client} auth - The authenticated OAuth2 client.
 * @param {string} spreadsheetId - The ID of the Google Spreadsheet.
 * @param {string} sheetId - The ID of the sheet to modify.
 * @param {number} rowIndex - The index of the row to change (0-based).
 * @param {string} colorName - The color name (e.g., "green", "red", "yellow", "orange", "magenta").
 */
async function changeRowColor(auth, spreadsheetId, sheetId, rowIndex, colorName) {
  const color = colorNameToRgb(colorName);
  const sheets = google.sheets({ version: 'v4', auth });
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: rowIndex, // inclusive
              endRowIndex: rowIndex + 1 // exclusive
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: color
              }
            },
            fields: 'userEnteredFormat.backgroundColor'
          }
        }
      ]
    }
  });

  console.log(`Row ${rowIndex + 1} color changed to ${colorName}!`);
}

export { downloadSheets, changeRowColor };
