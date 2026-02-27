import Bluebird from 'bluebird';
import minimist from 'minimist';
import path from 'path';
import { array_random } from 'sbg-utility';
import { fileURLToPath } from 'url';
import { loadCsvData } from '../../data/index.js';
import * as databaseModule from '../../dist/database/index.mjs';
import { processData } from '../../dist/runner/skrin/direct-process-data.mjs';
import { toValidMySQLDatabaseName } from '../database/db_utils.js';
import { closeOtherTabs, getPuppeteer } from '../puppeteer_utils.js';
import { getNumbersOnly, sleep } from '../utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { MYSQL_HOST, MYSQL_USER, MYSQL_PASS, MYSQL_PORT } = process.env;
const database = new databaseModule.LogDatabase(toValidMySQLDatabaseName('skrin_' + process.env.DATABASE_FILENAME), {
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
  const dataKunto = await Bluebird.filter(await loadCsvData(), async (data) => {
    const existing = await database.getLogById(getNumbersOnly(data.nik));
    if (existing && existing.data) return false;
    return true;
  });

  // Print remaining count before processing
  console.log(`Total entries to process: ${dataKunto.length}`);

  // Parse CLI flags using minimist: support --single and --shuffle
  const args = minimist(process.argv.slice(2));
  const flagSingle = Boolean(args.single);
  const flagShuffle = Boolean(args.shuffle);

  if (flagShuffle && Array.isArray(dataKunto) && dataKunto.length > 1) {
    // Fisher-Yates shuffle
    for (let i = dataKunto.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dataKunto[i], dataKunto[j]] = [dataKunto[j], dataKunto[i]];
    }
    console.log('Shuffled data ordering due to --shuffle flag');
  }

  if (flagSingle && Array.isArray(dataKunto) && dataKunto.length > 0) {
    dataKunto.splice(1); // keep only first element
    console.log('Processing single entry due to --single flag');
  }

  const puppeteer = puppeteerInstance;
  const browser = puppeteer.browser || puppeteer.page.browser();

  while (dataKunto.length > 0) {
    const remainingBefore = dataKunto.length;
    /**
     * @type {import('../../globals.js').ExcelRowData}
     */
    const data = await dataCallback(dataKunto.shift()); // <-- modify the data via callback
    console.log(`Remaining entries before processing current data: ${remainingBefore}`);

    const processPage = array_random(await browser.pages());
    await closeOtherTabs(processPage);

    const result = await processData(processPage, data, database);
    if (result.status === 'error') {
      console.error('fail processing data', Object.assign(result, { data }));
      // skip reason: duplicate entry (already exists in database)
      if (result.reason === 'duplicate_entry') {
        console.warn('Skipping due to duplicate entry in database, moving to next data');
        console.log(`Remaining entries after processing current data: ${dataKunto.length}`);
        continue;
      }
      // skip reason: invalid NIK format (not 16 digits)
      if (result.reason === 'invalid_nik_format') {
        console.warn('Skipping due to invalid NIK format, moving to next data');
        console.log(`Remaining entries after processing current data: ${dataKunto.length}`);
        continue;
      }
      console.log(`Remaining entries after processing current data: ${dataKunto.length}`);
      // wait until browser manually closed, then exit with failure
      while (true) {
        await sleep(1000);
        if (!browser || !browser.connected) {
          console.warn('Browser closed, exiting with failure due to previous error');
          process.exit(1);
        }
      }
    } else if (result.status !== 'success') {
      console.warn('Unexpected result status:', result.status, result);
      console.log(`Remaining entries after processing current data: ${dataKunto.length}`);
      process.exit(1); // exit on unexpected status to avoid silent failures
    } else {
      console.log('Successfully processed data for NIK:', data.nik);
      console.log(`Remaining entries after processing current data: ${dataKunto.length}`);
    }
  }

  console.log('All data processed.');

  await database.close();
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

  try {
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

        // give some time for stdout/stderr to flush, then exit with failure
        setTimeout(() => process.exit(1), 100);
        break;
      }
    }
  } finally {
    try {
      if (puppeteerInstance?.browser?.connected) {
        await puppeteerInstance.browser.close();
      }
    } catch (e) {
      console.error('Failed to close browser on exit:', e && e.stack ? e.stack : e);
    }
  }
}

// if (import.meta.url === pathToFileURL(process.argv[1]).href) {
//   executeSkriningProcess();
// }
