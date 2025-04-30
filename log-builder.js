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
 *
 * @param {Array<{ timestamp: string, type: string, data: Object }>} logs - The array of log entries.
 * @returns {string} HTML string representing the table rows.
 */
function generateTableRows(logs) {
  return logs
    .map(({ timestamp, type, data }) => {
      const rowClass = type.includes('Skipped') ? 'skipped' : 'processed';
      let keterangan = [];
      if (data.diabetes) keterangan.push('DIABETES');
      if (data.batuk) keterangan.push(data.batuk);
      const formattedTime = moment(timestamp).format('DD-MM-YYYY HH:mm:ss');

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
            <td>${data.umur ?? '-'}</td>
            <td>${data.gender ?? '-'}</td>
            <td>${keterangan.length > 0 ? keterangan.join(', ') : '-'}</td>
        </tr>`;
    })
    .join('');
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
  const rows = generateTableRows(logs);
  const finalHTML = template.replace('{{rows}}', rows);

  const minifiedHTML = await minify(finalHTML, {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeEmptyAttributes: true,
    minifyCSS: true,
    minifyJS: true
  });

  fs.writeFileSync(outputPath, minifiedHTML);

  console.log(`✅ Minified HTML file generated: ${outputPath}. Open it in a browser.`);
}

// Parse log data and generate HTML output
const logs = parseLogFile(defaultLogFilePath);
generateHTML(logs);
