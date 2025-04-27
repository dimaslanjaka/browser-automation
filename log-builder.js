import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { defaultLogFilePath } from './src/utils.js';
import moment from 'moment';
import { minify } from 'html-minifier-terser';

// Define __filename and __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Pastikan folder .cache ada
const cacheDir = join(__dirname, '.cache');
if (!existsSync(cacheDir)) {
  mkdirSync(cacheDir, { recursive: true });
}

const outputPath = join(__dirname, '.cache/log.html');
const templatePath = join(__dirname, 'template.html');

// Function to parse log data
function parseLogFile(logFilePath) {
  if (!existsSync(logFilePath)) {
    console.error(`❌ Log file not found: ${logFilePath}`);
    return [];
  }

  const logData = readFileSync(logFilePath, 'utf-8')
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

// Generate table rows
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

// Read template and replace {{rows}} placeholder
async function generateHTML(logs) {
  if (!existsSync(templatePath)) {
    console.error(`❌ Template file not found: ${templatePath}`);
    return;
  }

  const template = readFileSync(templatePath, 'utf-8');
  const rows = generateTableRows(logs);
  const finalHTML = template.replace('{{rows}}', rows);

  // Minify the HTML
  const minifiedHTML = await minify(finalHTML, {
    collapseWhitespace: true,
    removeComments: true,
    removeRedundantAttributes: true,
    removeEmptyAttributes: true,
    minifyCSS: true,
    minifyJS: true
  });

  writeFileSync(outputPath, minifiedHTML);

  console.log(`✅ Minified HTML file generated: ${outputPath}. Open it in a browser.`);
}

// Process logs and generate HTML
const logs = parseLogFile(defaultLogFilePath);
generateHTML(logs);
