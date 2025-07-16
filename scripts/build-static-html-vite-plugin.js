import fs from 'fs';
import nunjucks from 'nunjucks';
import path from 'path';
import { dataKunto } from '../data/index.js';
import { dbPath, getLogs } from '../src/logHelper.js';

const templatesPath = path.join(process.cwd(), 'templates');
nunjucks.configure(templatesPath, { autoescape: true, watch: true, noCache: true });

/**
 * Builds the static HTML log file from database logs and template.
 * @returns {string} The generated HTML content.
 */
export function buildStaticHtml(options) {
  let liveLogs = getLogs();
  // Sort liveLogs by item.data.nik order as in dataKunto
  if (Array.isArray(dataKunto) && Array.isArray(liveLogs)) {
    const nikOrder = dataKunto.map((item) => item.nik);
    const nikIndex = (nik) => nikOrder.indexOf(nik);
    liveLogs = liveLogs.slice().sort((a, b) => {
      const nikA = a.data && a.data.nik;
      const nikB = b.data && b.data.nik;
      return nikIndex(nikA) - nikIndex(nikB);
    });
  }
  const outLogsPath = path.resolve(process.cwd(), 'tmp/logs.json');
  fs.mkdirSync(path.dirname(outLogsPath), { recursive: true });
  fs.writeFileSync(outLogsPath, JSON.stringify(liveLogs, null, 2));
  console.log(`Logs JSON written to ${outLogsPath}`);
  const outHtmlPath = path.resolve(process.cwd(), 'public/log-juli-2025.html');
  const canonicalUrl = `https://www.webmanajemen.com/browser-automation/${path.basename(outHtmlPath)}`;
  // Count success and fail logs (case-insensitive)
  const successCount = liveLogs.filter((log) => log.data && log.data.status === 'success').length;
  const failCount = liveLogs.filter((log) => log.data && log.data.status !== 'success').length;
  const pageTitle = options?.pageTitle || 'Data Kunto Juli 2025';
  let liveHtml = nunjucks.render('log-viewer.njk', {
    logs: liveLogs,
    successCount,
    failCount,
    pageTitle,
    canonicalUrl,
    logsJson: JSON.stringify(liveLogs)
  });
  fs.mkdirSync(path.dirname(outHtmlPath), { recursive: true });
  fs.writeFileSync(outHtmlPath, liveHtml);
  console.log(`Log HTML written to ${outHtmlPath}`);
  return liveHtml;
}

/**
 * Vite plugin to watch the database file and trigger a full reload when it changes.
 * Runs buildStaticHtml on dev server startup and on .db file changes.
 * @returns {import('vite').Plugin} Vite plugin object
 */
export default function dbLogHtmlStatic() {
  return {
    name: 'db-log-html-static',
    configureServer(server) {
      // Run on dev server startup
      buildStaticHtml();

      // Add files to watch
      server.watcher.add([dbPath]);
      // Listen for changes
      server.watcher.on('change', (file) => {
        if (file.endsWith('.db')) {
          buildStaticHtml();
          // server.ws.send({ type: 'full-reload' });
        }
      });
    }
  };
}
