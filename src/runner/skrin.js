import dotenv from 'dotenv';
import minimist from 'minimist';
import path from 'path';
import { array_random } from 'sbg-utility';
import { fileURLToPath } from 'url';
import { loadCsvData } from '../../data/index.js';
import * as databaseModule from '../../dist/database/index.mjs';
import { processData } from '../../dist/runner/skrin/direct-process-data.mjs';
import { playMp3FromUrl } from '../beep.js';
import { toValidMySQLDatabaseName } from '../database/db_utils.js';
import { closeOtherTabs, getPuppeteer } from '../puppeteer_utils.js';
import { autoLoginAndEnterSkriningPage } from '../skrin_puppeteer.js';
import { getNumbersOnly, sleep } from '../utils.js';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { MYSQL_HOST, MYSQL_USER, MYSQL_PASS, MYSQL_PORT } = process.env;
const database = new databaseModule.LogDatabase('skrin_' + toValidMySQLDatabaseName(process.env.DATABASE_FILENAME), {
  connectTimeout: 60000,
  connectionLimit: 10,
  host: MYSQL_HOST || 'localhost',
  user: MYSQL_USER || 'root',
  password: MYSQL_PASS || '',
  port: Number(MYSQL_PORT) || 3306,
  type: MYSQL_HOST ? 'mysql' : 'sqlite'
});

/**
 * Main function to automate processing of multiple rows of Excel data for skrining entry.
 *
 * Logs into the web application, iterates through the data entries, and processes each one using `processData`.
 * Optionally allows transformation of each row of data through a callback before processing.
 *
 * @param {{browser: import('puppeteer').Browser, page: import('puppeteer').Page}} puppeteerInstance
 *   Puppeteer instance created by `getPuppeteer()` (an object with `browser` and `page`).
 *   When provided, `runEntrySkrining` will use this instance and will not create/close the browser itself —
 *   this allows the caller (for example a supervisor main loop) to reuse the browser across restarts.
 * @param {(data: import('../../globals.js').ExcelRowData) => import('../../globals.js').ExcelRowData | Promise<import('../../globals.js').ExcelRowData>} [dataCallback]
 *   A callback to optionally transform each Excel data row before processing. Can be synchronous or asynchronous.
 *   Defaults to an identity function if not provided.
 * @returns {Promise<void>} A promise that resolves when all data entries are processed. The browser is not closed by this
 *   function when a `puppeteerInstance` is supplied; the caller is responsible for closing it.
 */
export async function runEntrySkrining(puppeteerInstance, dataCallback = (data) => data) {
  // const datas = getXlsxData(process.env.index_start, process.env.index_end);
  // const datas = await fetchXlsxData3(process.env.index_start, process.env.index_end);
  let datas = await loadCsvData();
  // Parse CLI flags using minimist: support --single and --shuffle
  const args = minimist(process.argv.slice(2));
  const flagSingle = Boolean(args.single);
  const flagShuffle = Boolean(args.shuffle);

  if (flagShuffle && Array.isArray(datas) && datas.length > 1) {
    // Fisher-Yates shuffle
    for (let i = datas.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [datas[i], datas[j]] = [datas[j], datas[i]];
    }
    console.log('Shuffled data ordering due to --shuffle flag');
  }

  if (flagSingle && Array.isArray(datas) && datas.length > 0) {
    datas = [datas[0]];
    console.log('Processing single entry due to --single flag');
  }

  const puppeteer = puppeteerInstance;
  const page = puppeteer.page;
  const browser = puppeteer.browser;

  while (datas.length > 0) {
    /**
     * @type {import('../../globals.js').ExcelRowData}
     */
    const data = await dataCallback(datas.shift()); // <-- modify the data via callback
    const existing = await database.getLogById(getNumbersOnly(data.nik));
    if (existing && existing.data) {
      const status = existing.data.status || 'unknown';
      const message = existing.message || '';
      console.log(`Data for NIK ${data.nik} already processed. Skipping. Status: ${status}. Message: ${message}`);
      continue;
    }

    await closeOtherTabs(page);

    const processPage = array_random(await browser.pages());
    try {
      await autoLoginAndEnterSkriningPage(processPage);
    } catch (e) {
      await playMp3FromUrl('https://assets.mixkit.co/active_storage/sfx/1084/1084.wav').catch(console.error);
      throw e;
    }

    const result = await processData(processPage, data);
    if (result.status === 'error') {
      console.error(Object.assign(result, { data }));
      break; // stop processing further on error, to allow investigation and fixes
    } else if (result.status !== 'success') {
      console.warn('Unexpected result status:', result.status, result);
      process.exit(1); // exit on unexpected status to avoid silent failures
    }
  }

  console.log('All data processed.');

  // Completed run - database logging used instead of HTML log builds
}

export async function executeSkriningProcess() {
  let puppeteerInstance;
  try {
    puppeteerInstance = await getPuppeteer();
  } catch (e) {
    console.error('Failed to launch puppeteer:', e && e.stack ? e.stack : e);
    setTimeout(() => process.exit(1), 100);
    return;
  }

  while (true) {
    try {
      await runEntrySkrining(puppeteerInstance);
      break; // finished successfully
    } catch (err) {
      const msg =
        err && (err.stack || err.message || String(err)) ? err.stack || err.message || String(err) : String(err);
      console.error('Unhandled error in runEntrySkrining:', msg);
      const lowerMsg = String(msg).toLowerCase();
      if (lowerMsg.includes('net::err_connection_timed_out') || lowerMsg.includes('navigation timeout')) {
        console.warn('Detected connection/navigation timeout — restarting in 1s...');
        await sleep(1000);
        continue; // restart loop, reuse puppeteerInstance
      }

      // non-recoverable error: close browser then exit
      try {
        await puppeteerInstance.browser.close();
      } catch (e) {
        console.error('Failed to close browser after error:', e && e.stack ? e.stack : e);
      }

      // give some time for stdout/stderr to flush, then exit with failure
      setTimeout(() => process.exit(1), 100);
      break;
    }
  }

  // finished successfully, close browser
  try {
    await puppeteerInstance.browser.close();
  } catch (e) {
    console.error('Failed to close browser on exit:', e && e.stack ? e.stack : e);
  }
}

// if ('skrin' === path.basename(__filename, '.js')) {
//   executeSkriningProcess();
// }
