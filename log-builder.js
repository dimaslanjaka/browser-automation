import dotenv from 'dotenv';
import { minify } from 'html-minifier-terser';
import moment from 'moment';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writefile } from 'sbg-utility';
import { newLogPath } from './skrin.log-restart.js';
import { defaultLogFilePath } from './src/utils.js';

// Define __filename and __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Ensure .cache directory exists
const cacheDir = path.join(__dirname, '.cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

const templatePath = path.join(__dirname, 'template.html');

/**
 * Parses a log file and returns an array of structured log entries.
 *
 * @param {string} logFilePath - The path to the log file.
 * @returns {Array<{ timestamp: string, type: string, data: Object, minIndex: number, maxIndex: number }>} An array of log entry objects.
 */
export function parseLogFile(logFilePath) {
  if (!fs.existsSync(logFilePath)) {
    console.error(`❌ Log file not found: ${logFilePath}`);
    return [];
  }

  const logData = fs
    .readFileSync(logFilePath, 'utf-8')
    .split(/\r?\n/)
    .filter((line) => line.trim() !== '');
  const rowIndexes = [...logData.join(/\r?\n/).matchAll(/"rowIndex":(\d+)/g)].map((m) => parseInt(m[1], 10));
  let minIndex = 0;
  let maxIndex = 0;

  if (rowIndexes.length > 0) {
    minIndex = Math.min(...rowIndexes);
    maxIndex = Math.max(...rowIndexes);
    console.log(`RowIndex Range: ${minIndex} - ${maxIndex}`);
  } else {
    console.log('No rowIndex found');
  }

  return logData
    .map((line) => {
      const match = line.match(/^(.*?) - (.*?): (\{.*\})$/);
      if (!match) return null;

      const [_, timestamp, type, jsonString] = match;
      let data;
      try {
        data = JSON.parse(jsonString);
      } catch (_e) {
        return null;
      }

      return { timestamp, type, data, minIndex, maxIndex };
    })
    .filter((entry) => entry !== null);
}

/**
 * Generates HTML table rows from parsed log data.
 * Any additional keys in the data object not listed in the predefined columns
 * will be grouped into a single last <td>. If none exist, the cell will contain a dash ('-').
 *
 * @param {Array<{ timestamp: string, type: string, data: import('./globals.d.ts').ExcelRowData }>} logs - The array of log entries.
 * @returns {{ rowsHTML: string, rowClassCounts: { invalid: number, skipped: number, processed: number, estimated: string } }}
 * An object containing:
 * - `rowsHTML`: A string representing the HTML for the table rows.
 * - `rowClassCounts`: An object with counts of each row class type:
 *   - `invalid`: Number of rows classified as invalid.
 *   - `skipped`: Number of rows classified as skipped.
 *   - `processed`: Number of rows classified as processed.
 *   - `estimated`: The estimated time difference between the first and last timestamps, formatted as "X days Y hours Z minutes W seconds".
 */
export function generateTableRows(logs) {
  const predefinedKeys = [
    'rowIndex',
    'tanggal',
    'nama',
    'nik',
    'pekerjaan',
    'pekerjaan_original',
    'bb',
    'tb',
    'umur',
    'gender',
    'diabetes',
    'batuk',
    'tgl_lahir',
    'alamat'
  ];

  const counter = {
    invalid: 0,
    skipped: 0,
    processed: 0,
    estimated: ''
  };

  const rows = logs
    .map(({ timestamp, type, data }) => {
      let rowClass;
      if (data.nik.length != 16) {
        rowClass = 'invalid';
        counter['invalid']++;
      } else if (type == 'Skipped Data') {
        rowClass = 'skipped';
        counter['skipped']++;
      } else if (type == 'Processed Data') {
        rowClass = 'processed';
        counter['processed']++;
      } else if (type == 'Processed Skipped Data') {
        rowClass = 'processed-skipped';
        counter['processed']++;
      } else {
        throw new Error(`Unknown type: ${type}`);
      }

      const keterangan = [];
      if (data.diabetes) keterangan.push('DIABETES');
      if (data.batuk) keterangan.push(data.batuk);
      const formattedTime = moment(timestamp).format('DD-MM-YYYY HH:mm:ss');

      // Collect additional key-value pairs into a single string
      const additionalEntries = Object.entries(data).filter(([key]) => !predefinedKeys.includes(key));

      const additionalInfo =
        additionalEntries.length > 0
          ? additionalEntries
              .map(([key, value]) => {
                let formattedValue;
                if (value === null || value === undefined) {
                  formattedValue = '-';
                } else if (typeof value === 'object') {
                  formattedValue = JSON.stringify(value, null, 2); // pretty print
                } else {
                  formattedValue = String(value);
                }
                return `${key}: ${formattedValue}`;
              })
              .join(', ')
          : '-';

      const birthDate = `${data.tgl_lahir ?? ''} (${data.umur ?? '-'})`;

      return `
      <tr class="${rowClass}">
          <td>${formattedTime}</td>
          <td>${data.rowIndex ?? '-'}</td>
          <td>${data.tanggal ?? '-'}</td>
          <td copy-data="${data.nama ?? '-'}">${data.nama ?? '-'}</td>
          <td copy-data="${data.nik ?? '-'}">${data.nik ?? '-'}</td>
          <td>${data.pekerjaan ?? '-'}</td>
          <td>${data.pekerjaan_original ?? '-'}</td>
          <td copy-data="${data.bb ?? '-'}">${data.bb ?? '-'}</td>
          <td copy-data="${data.tb ?? '-'}">${data.tb ?? '-'}</td>
          <td copy-data="${data.tgl_lahir ?? '-'}">${data.tgl_lahir ? birthDate : '-'}</td>
          <td>${data.gender ?? '-'}</td>
          <td copy-data="${data.alamat ?? '-'}">${data.alamat ?? '-'}</td>
          <td>${keterangan.length > 0 ? keterangan.join(', ') : '-'}</td>
          <td>${additionalInfo}</td>
      </tr>`;
    })
    .join('');

  // Count estimated time
  const timestamps = logs;
  // 1. Sort the array based on timestamp
  timestamps.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // 2. Calculate the time difference between the first and last timestamp
  const startTimestamp = new Date(timestamps[0].timestamp);
  const endTimestamp = new Date(timestamps[timestamps.length - 1].timestamp);
  const timeDifference = endTimestamp - startTimestamp;

  // 3. Convert the time difference to days, hours, minutes, and seconds
  const totalSeconds = timeDifference / 1000;
  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);

  // 4. Set the result
  const timeParts = [];
  if (days > 0) timeParts.push(`${days} hari`);
  if (hours > 0) timeParts.push(`${hours} jam`);
  if (minutes > 0) timeParts.push(`${minutes} menit`);
  if (seconds > 0) timeParts.push(`${seconds} detik`);

  counter.estimated = timeParts.length > 0 ? timeParts.join(' ') : '-';

  // Return the rows HTML and the counts of each rowClass
  return {
    rowsHTML: rows,
    rowClassCounts: counter
  };
}

/**
 * Generates and writes a minified HTML file using the template and log data.
 *
 * @param {Array<{ timestamp: string, type: string, data: Object, minIndex: number, maxIndex: number }>} logs - Parsed log entries.
 * @returns {Promise<void>}
 */
export async function generateHTML(logs) {
  if (!fs.existsSync(templatePath)) {
    console.error(`❌ Template file not found: ${templatePath}`);
    return;
  }

  const template = fs.readFileSync(templatePath, 'utf-8');
  const { rowClassCounts, rowsHTML } = generateTableRows(logs);
  const finalHTML = template
    .replace('{{rows}}', rowsHTML)
    .replace(/\[total-processed\]/g, rowClassCounts.processed)
    .replace(/\[total-invalid\]/g, rowClassCounts['invalid'])
    .replace(/\[total-skipped\]/g, rowClassCounts.skipped)
    .replace(/\[estimated-time\]/g, rowClassCounts.estimated)
    .replace(/\[min-range\]/g, logs.at(0).minIndex)
    .replace(/\[max-range\]/g, logs.at(0).maxIndex);

  const minifiedHTML = await minify(finalHTML, {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeEmptyAttributes: true,
    minifyCSS: true,
    minifyJS: true
  });

  return minifiedHTML;
}

async function generateAndSave(logPath, fileName) {
  const logs = parseLogFile(logPath);
  const publicDir = path.join(__dirname, 'public');
  const generatedHtml = await generateHTML(logs);
  const publicFilePath = path.join(publicDir, fileName);
  writefile(publicFilePath, generatedHtml);
  console.log(`✅ Minified HTML file generated: ${publicFilePath}.`);
}

if (process.argv[1] === __filename) {
  (async function () {
    const logs1 = parseLogFile(defaultLogFilePath);
    const logs2 = parseLogFile(newLogPath);

    await generateAndSave(defaultLogFilePath, `log-${logs1.at(0).minIndex}-${process.env.index_end}.html`);
    await generateAndSave(newLogPath, `new-log-${logs2.at(0).minIndex}-${process.env.index_end}.html`);
  })();
}
