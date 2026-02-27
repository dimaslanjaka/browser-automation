import Bluebird from 'bluebird';
import { connect } from '../parallel-browsers/utils.js';
import type { Browser } from 'puppeteer';
import { loadCsvData } from '../../data/index.js';
import { ExcelRowData } from '../../globals.js';
import { getNumbersOnly } from '../utils-browser.js';
import { toValidMySQLDatabaseName } from '../database/db_utils.js';
import { LogDatabase } from '../database/LogDatabase.js';
import { processData } from './skrin/direct-process-data.js';
import { closeOtherTabs } from '../puppeteer_utils.js';

type DatabaseData = {
  id: string;
  data: any;
  message: string;
};
const { MYSQL_HOST, MYSQL_USER, MYSQL_PASS, MYSQL_PORT } = process.env;
const database = new LogDatabase<DatabaseData>(toValidMySQLDatabaseName('skrin_' + process.env.DATABASE_FILENAME), {
  connectTimeout: 60000,
  connectionLimit: 10,
  host: MYSQL_HOST || 'localhost',
  user: MYSQL_USER || 'root',
  password: MYSQL_PASS || '',
  port: Number(MYSQL_PORT) || 3306,
  type: MYSQL_HOST ? 'mysql' : 'sqlite'
});

const parallelRunsFromEnv = Number(process.env.SKRIN_PARALLEL_RUNS);
const retryAttemptsFromEnv = Number(process.env.SKRIN_RETRY_ATTEMPTS);
const retryDelayMsFromEnv = Number(process.env.SKRIN_RETRY_DELAY_MS);

const parallelRuns =
  Number.isFinite(parallelRunsFromEnv) && parallelRunsFromEnv > 0 ? Math.floor(parallelRunsFromEnv) : 2;
const retryAttempts =
  Number.isFinite(retryAttemptsFromEnv) && retryAttemptsFromEnv > 0 ? Math.floor(retryAttemptsFromEnv) : 2;
const retryDelayMs = Number.isFinite(retryDelayMsFromEnv) && retryDelayMsFromEnv > 0 ? retryDelayMsFromEnv : 3000;
const activeBrowsers = new Set<Browser>();
let isShuttingDown = false;

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function closeAllBrowsers() {
  const browsers = [...activeBrowsers];
  if (!browsers.length) return;

  await Promise.allSettled(
    browsers.map(async (browser) => {
      await browser.close();
      activeBrowsers.delete(browser);
    })
  );
}

async function closeDatabase() {
  try {
    if (!database.isClosed()) {
      await database.close();
    }
  } catch (error) {
    console.error('Error while closing database:', error);
  }
}

async function shutdownAndExit(code: number) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  try {
    await closeAllBrowsers();
    await closeDatabase();
  } catch (error) {
    console.error('Error while shutting down resources:', error);
  } finally {
    process.exit(code);
  }
}

async function processRowWithRetry(row: ExcelRowData, browser: Browser, workerIndex: number) {
  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    // keep last 2 tabs open for retry, close others
    closeOtherTabs(browser, 2);
    const page = await browser.newPage();

    try {
      await processData(page, row, database);
      return;
    } catch (error) {
      const isLastAttempt = attempt === retryAttempts;
      console.error(
        `Error processing data for NIK: ${row.nik} on worker ${workerIndex} (attempt ${attempt}/${retryAttempts}):`,
        error
      );

      if (isLastAttempt) {
        return;
      }

      await sleep(retryDelayMs * attempt);
    }
  }
}

async function main() {
  try {
    const dataKunto = await Bluebird.filter((await loadCsvData()) as ExcelRowData[], async (data) => {
      const existing = await database.getLogById(getNumbersOnly(data.nik));
      if (existing && existing.data) return false;
      return true;
    });
    // Shuffle dataKunto array
    for (let i = dataKunto.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dataKunto[i], dataKunto[j]] = [dataKunto[j], dataKunto[i]];
    }

    await Bluebird.map(
      Array.from({ length: parallelRuns }),
      async (_, workerIndex) => {
        const browser = await connect();
        activeBrowsers.add(browser);

        try {
          for (let i = workerIndex; i < dataKunto.length; i += parallelRuns) {
            const row = dataKunto[i];
            if (!row) {
              continue;
            }

            await processRowWithRetry(row, browser, workerIndex);
          }
        } finally {
          await browser.close().catch((error) => {
            console.error(`Failed to close browser for worker ${workerIndex}:`, error);
          });
          activeBrowsers.delete(browser);
        }
      },
      { concurrency: parallelRuns }
    );
  } catch (error) {
    console.error('Error during page operations:', error);
  } finally {
    await closeDatabase();
  }
}

process.on('SIGINT', () => {
  console.log('SIGINT received. Closing all browsers...');
  void shutdownAndExit(130);
});

main().catch((error) => {
  console.error('Error launching browser:', error);
  void shutdownAndExit(1);
});
