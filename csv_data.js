import csv from 'csv-parser';
import dotenv from 'dotenv';
import * as glob from 'glob';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

// Get the absolute path of the current script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Log file path
const logFile = path.join(__dirname, 'tmp', 'csv-data.log');

/**
 * Initialize log file (reset on startup)
 */
function initLogFile() {
  const logDir = path.dirname(logFile);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  // Reset log file on startup
  fs.writeFileSync(logFile, '', 'utf8');
}

/**
 * Log message to both console and file
 * @param {string} message - The message to log
 * @param {any} data - Optional data to log
 */
function logToFileAndConsole(message, data = '') {
  const timestamp = new Date().toISOString();
  const logMessage = data ? `[${timestamp}] ${message} ${typeof data === 'object' ? JSON.stringify(data, null, 2) : data}` : `[${timestamp}] ${message}`;

  // Log to console
  if (data && typeof data === 'object') {
    console.log(message, data);
  } else {
    console.log(data ? `${message} ${data}` : message);
  }

  // Log to file
  fs.appendFileSync(logFile, logMessage + '\n', 'utf8');
}

/**
 * @typedef {Record<string, any> & { rowIndex: number }} CsvRow
 */

/**
 * Search for rows by NIK value(s)
 * @param {string | string[]} nikValue - The NIK value(s) to search for
 * @returns {Promise<CsvRow[]>} - Array of matching rows
 */
export async function searchByNik(nikValue) {
  const allData = await getCsvData();

  // Handle both single string and array of strings
  if (Array.isArray(nikValue)) {
    return allData.filter(row => nikValue.includes(row.NIK));
  } else {
    return allData.filter(row => row.NIK === nikValue);
  }
}

/**
 * @param {number} startIndex
 * @param {number} lastIndex
 * @returns {Promise<CsvRow[]>}
 */
export async function getCsvData(startIndex = 0, lastIndex = Number.MAX_SAFE_INTEGER) {
  const csvFiles = await glob.glob('.cache/sheets/*.csv', {
    cwd: process.cwd(),
    absolute: true
  });

  /** @type {CsvRow[]} */
  const allData = [];
  let currentIndex = 0;

  for (const file of csvFiles) {
    const fileData = await new Promise((resolve, reject) => {
      /** @type {CsvRow[]} */
      const rows = [];
      fs.createReadStream(file)
        .pipe(csv())
        .on('data', (data) => {
          /** @type {CsvRow} */
          const row = { ...data, rowIndex: currentIndex++ };
          rows.push(row);
        })
        .on('end', () => resolve(rows))
        .on('error', reject);
    });

    allData.push(...fileData);
  }

  return allData.slice(startIndex, lastIndex + 1);
}

if (process.argv[1] === __filename) {
  (async () => {
    // Initialize log file (reset on startup)
    initLogFile();

    const datas = await getCsvData();
    let lastItem = datas.at(process.env.index_start);
    let firstItem = datas.at(process.env.index_end);
    logToFileAndConsole('total data:', datas.length);
    logToFileAndConsole('first data:', firstItem);
    logToFileAndConsole('last data:', lastItem);

    // Example: Search by NIK
    logToFileAndConsole('\n--- Search by NIK Example ---');
    const nikToSearch = ['3578106311200003','3578101502250001'];
    const searchResults = await searchByNik(nikToSearch);
    logToFileAndConsole(`Search results for NIKs "${nikToSearch.join(', ')}":`, `${searchResults.length} found`);

    if (searchResults.length > 0) {
      logToFileAndConsole('All matches:');
      searchResults.forEach((result, index) => {
        logToFileAndConsole(`Match ${index + 1} - NIK: ${result.NIK}, Index: ${result.rowIndex}, Name: ${result.NAMA}`);
      });

      // Show summary by NIK
      logToFileAndConsole('\n--- Summary by NIK ---');
      nikToSearch.forEach(nik => {
        const matches = searchResults.filter(result => result.NIK === nik);
        if (matches.length > 0) {
          logToFileAndConsole(`NIK ${nik}: ${matches.length} match(es) found`);
          matches.forEach((match, index) => {
            logToFileAndConsole(`  - Match ${index + 1}: Index ${match.rowIndex}, Name: ${match.NAMA}`);
          });
        } else {
          logToFileAndConsole(`NIK ${nik}: No matches found`);
        }
      });
    } else {
      logToFileAndConsole('No matches found for any of the searched NIKs');
    }
  })();
}
