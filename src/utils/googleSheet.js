import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import xlsx from 'xlsx';

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

export { downloadSheets };
