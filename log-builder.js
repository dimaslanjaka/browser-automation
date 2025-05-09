import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultLogFilePath } from './src/utils.js';
import moment from 'moment';
import { minify } from 'html-minifier-terser';

// Define __filename and __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure .cache directory exists
const cacheDir = path.join(__dirname, '.cache');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

const outputPath = path.join(__dirname, '.cache/log.html');
const templatePath = path.join(__dirname, 'template.html');

/**
 * Parses a log file and returns an array of structured log entries.
 *
 * @param {string} logFilePath - The path to the log file.
 * @returns {Array<{ timestamp: string, type: string, data: Object }>} An array of log entry objects.
 */
function parseLogFile(logFilePath) {
  if (!fs.existsSync(logFilePath)) {
    console.error(`❌ Log file not found: ${logFilePath}`);
    return [];
  }

  const logData = fs
    .readFileSync(logFilePath, 'utf-8')
    .split('\n')
    .filter((line) => line.trim() !== '');

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

      return { timestamp, type, data };
    })
    .filter((entry) => entry !== null);
}

/**
 * Generates HTML table rows from parsed log data.
 * Any additional keys in the data object not listed in the predefined columns
 * will be grouped into a single last <td>. If none exist, the cell will contain a dash.
 *
 * @param {Array<{ timestamp: string, type: string, data: import('./globals.d.ts').ExcelRowData }>} logs - The array of log entries.
 * @returns {{ rowsHTML: string, rowClassCounts: { 'invalid': number, skipped: number, processed: number } }}
 * An object containing the HTML string representing the table rows and an object with the counts of each row class type.
 */
function generateTableRows(logs) {
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
    'tgl_lahir'
  ];

  const counter = {
    invalid: 0,
    skipped: 0,
    processed: 0
  };

  const rows = logs
    .map(({ timestamp, type, data }) => {
      let rowClass;
      if (data.nik.length != 16) {
        rowClass = 'invalid';
        counter['invalid']++;
      } else if (type.includes('Skipped')) {
        rowClass = 'skipped';
        counter['skipped']++;
      } else {
        rowClass = 'processed';
        counter['processed']++;
      }

      const keterangan = [];
      if (data.diabetes) keterangan.push('DIABETES');
      if (data.batuk) keterangan.push(data.batuk);
      const formattedTime = moment(timestamp).format('DD-MM-YYYY HH:mm:ss');

      // Collect additional key-value pairs into a single string
      const additionalEntries = Object.entries(data).filter(([key]) => !predefinedKeys.includes(key));

      const additionalInfo =
        additionalEntries.length > 0
          ? additionalEntries.map(([key, value]) => `${key}: ${value ?? '-'}`).join(', ')
          : '-';

      const birthDate = `${data.tgl_lahir ?? ''} (${data.umur ?? '-'})`;

      return `
      <tr class="${rowClass}">
          <td>${formattedTime}</td>
          <td>${data.rowIndex ?? '-'}</td>
          <td>${data.tanggal ?? '-'}</td>
          <td>${data.nama ?? '-'}</td>
          <td>${data.nik ?? '-'}</td>
          <td>${data.pekerjaan ?? '-'}</td>
          <td>${data.pekerjaan_original ?? '-'}</td>
          <td>${data.bb ?? '-'}</td>
          <td>${data.tb ?? '-'}</td>
          <td>${data.tgl_lahir ? birthDate : '-'}</td>
          <td>${data.gender ?? '-'}</td>
          <td>${keterangan.length > 0 ? keterangan.join(', ') : '-'}</td>
          <td>${additionalInfo}</td>
      </tr>`;
    })
    .join('');

  // Return the rows HTML and the counts of each rowClass
  return {
    rowsHTML: rows,
    rowClassCounts: counter
  };
}

/**
 * Generates and writes a minified HTML file using the template and log data.
 *
 * @param {Array<{ timestamp: string, type: string, data: Object }>} logs - Parsed log entries.
 * @returns {Promise<void>}
 */
async function generateHTML(logs) {
  if (!fs.existsSync(templatePath)) {
    console.error(`❌ Template file not found: ${templatePath}`);
    return;
  }

  const template = fs.readFileSync(templatePath, 'utf-8');
  const { rowClassCounts, rowsHTML } = generateTableRows(logs);
  const finalHTML = template
    .replace('{{rows}}', rowsHTML)
    .replace('[total-processed]', rowClassCounts.processed)
    .replace('[total-invalid]', rowClassCounts['invalid'])
    .replace('[total-skipped]', rowClassCounts.skipped);

  const minifiedHTML = await minify(finalHTML, {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeEmptyAttributes: true,
    minifyCSS: true,
    minifyJS: true
  });

  fs.writeFileSync(outputPath, minifiedHTML);

  console.log(`✅ Minified HTML file generated: ${outputPath}.`);
}

// Parse log data and generate HTML output
const logs = parseLogFile(defaultLogFilePath);
generateHTML(logs);
