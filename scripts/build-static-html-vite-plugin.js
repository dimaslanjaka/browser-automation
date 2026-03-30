import fs from 'fs-extra';
import nunjucks from 'nunjucks';
import path from 'path';
import { loadCsvData } from '../data/index.js';
import { getDatabaseFilePath } from '../src/database/SQLiteLogDatabase.js';
import { toValidMySQLDatabaseName } from '../src/database/db_utils.js';
import * as databaseModule from '../dist/database/index.mjs';
import dotenv from 'dotenv';
import { encryptJson } from '../src/utils/json-crypto.js';

// Load .env from parent directory
dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: true, quiet: true });

const templatesPath = path.join(process.cwd(), 'templates');
nunjucks.configure(templatesPath, { autoescape: true, watch: false, noCache: true });
const filename = process.env.DATABASE_FILENAME;
const dbPath = getDatabaseFilePath(filename);
const currentYear = new Date().getFullYear();
export const outHtmlPath = path.resolve(process.cwd(), `public/log-${filename}-${currentYear}.html`);
export const outLogsPath = path.resolve(process.cwd(), 'public/assets/data/logs.json');
fs.ensureDirSync(path.dirname(outHtmlPath));
fs.ensureDirSync(path.dirname(outLogsPath));

/**
 * Builds the static HTML log file from database logs and template.
 * @async
 * @param {object} [options] - Optional options for HTML generation.
 * @param {string} [options.pageTitle] - Custom page title for the HTML output.
 * @returns {Promise<string>} The generated HTML content.
 */
export async function buildStaticHtml(options) {
  const dataKunto = await loadCsvData();
  const envDbName = process.env.DATABASE_FILENAME || 'default';
  const sanitizedName = toValidMySQLDatabaseName('skrin_' + envDbName);
  console.log(`buildStaticHtml: DATABASE_FILENAME='${envDbName}'`);
  const { MYSQL_HOST, MYSQL_USER, MYSQL_PASS, MYSQL_PORT } = process.env;
  const database = new databaseModule.LogDatabase(sanitizedName, {
    connectTimeout: 60000,
    connectionLimit: 10,
    host: MYSQL_HOST || 'localhost',
    user: MYSQL_USER || 'root',
    password: MYSQL_PASS || '',
    port: Number(MYSQL_PORT) || 3306,
    type: MYSQL_HOST ? 'mysql' : 'sqlite'
  });
  let liveLogs = await database.getLogs(() => true);
  await database.close();
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

  fs.mkdirSync(path.dirname(outLogsPath), { recursive: true });
  const secret = process.env.VITE_JSON_SECRET;
  if (!secret) throw new Error('VITE_JSON_SECRET is not set in environment variables');
  fs.writeFileSync(outLogsPath, encryptJson(liveLogs, secret));
  console.log(`Logs JSON written to ${outLogsPath} (${Array.isArray(liveLogs) ? liveLogs.length : 0} logs)`);
  const canonicalUrl = `https://www.webmanajemen.com/browser-automation/${path.basename(outHtmlPath)}`;
  // Count success and fail logs (case-insensitive)
  const successCount = liveLogs.filter((log) => log.data && log.data.status === 'success').length;
  const failCount = liveLogs.filter((log) => log.data && log.data.status !== 'success').length;
  const pageTitle = options?.pageTitle || `Data Kunto ${currentYear}`;
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
    async configureServer(server) {
      // Dev server: generate on startup and on .db changes
      await buildStaticHtml();
      server.watcher.add([dbPath]);
      server.watcher.on('change', async (file) => {
        if (file.endsWith(path.extname(dbPath))) {
          await buildStaticHtml();
        }
      });
      // Add custom middleware for /vite/build (compatible with Vite 4/5)
      server.middlewares.use('/vite/build', async (req, res, _next) => {
        try {
          await buildStaticHtml();
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: true, message: 'Static HTML built.' }));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
    },
    async buildStart() {
      // Production build: generate once at build start
      await buildStaticHtml();
    }
  };
}

if (process.argv.some((arg) => arg.includes('build-static-html'))) {
  buildStaticHtml();
}
