import Bluebird from 'bluebird';
import minimist from 'minimist';
import { connect } from '../parallel-browsers/utils.js';
import type { Browser } from 'puppeteer';
import { loadCsvData } from '../../data/index.js';
import { ExcelRowData } from '../../globals.js';
import { getNumbersOnly } from '../utils-browser.js';
import { toValidMySQLDatabaseName } from '../database/db_utils.js';
import { LogDatabase } from '../database/LogDatabase.js';
import { processData } from './skrin/direct-process-data.js';
import { closeOtherTabs } from '../puppeteer_utils.js';
import { array_shuffle } from 'sbg-utility';

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

const cliArgs = minimist(process.argv.slice(2), {
  string: ['concurrent'],
  alias: {
    c: 'concurrent'
  }
});

const parallelRunsFromCli = Number(cliArgs.concurrent);
const hasValidParallelRunsFromCli = Number.isInteger(parallelRunsFromCli) && parallelRunsFromCli > 0;

const parallelRuns = hasValidParallelRunsFromCli
  ? parallelRunsFromCli
  : Number.isFinite(parallelRunsFromEnv) && parallelRunsFromEnv > 0
    ? Math.floor(parallelRunsFromEnv)
    : 2;
const retryAttempts =
  Number.isFinite(retryAttemptsFromEnv) && retryAttemptsFromEnv > 0 ? Math.floor(retryAttemptsFromEnv) : 2;
const retryDelayMs = Number.isFinite(retryDelayMsFromEnv) && retryDelayMsFromEnv > 0 ? retryDelayMsFromEnv : 3000;
const activeBrowsers = new Set<Browser>();
let isShuttingDown = false;

if (cliArgs.concurrent !== undefined && !hasValidParallelRunsFromCli) {
  console.warn(`Invalid --concurrent value: ${String(cliArgs.concurrent)}. Falling back to configured default.`);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function closeAllBrowsers() {
  const browsers = [...activeBrowsers];
  if (!browsers.length) return;

  await Promise.allSettled(
    browsers.map(async (browser) => {
      await browser
        .close()
        .then(() => activeBrowsers.delete(browser))
        .catch((error) => {
          console.error('Failed to close browser during shutdown:', error);
        });
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
    const dataKunto = await Bluebird.resolve((await loadCsvData()) as ExcelRowData[])
      .filter(async (data) => {
        const existing = await database.getLogById(getNumbersOnly(data.nik));
        return !(existing && existing.data);
      })
      .then(array_shuffle);

    const totalRows = dataKunto.length;
    let processedRows = 0;

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

            const beforeRemaining = Math.max(totalRows - processedRows, 0);
            console.log(
              `[worker ${workerIndex}] Before processing NIK ${row.nik}: ${beforeRemaining} data left (including current).`
            );

            await processRowWithRetry(row, browser, workerIndex);

            processedRows += 1;
            const afterRemaining = Math.max(totalRows - processedRows, 0);
            console.log(`[worker ${workerIndex}] After processing NIK ${row.nik}: ${afterRemaining} data left.`);
          }
        } finally {
          await browser
            .close()
            .then(() => activeBrowsers.delete(browser))
            .catch((error) => {
              console.error(`Failed to close browser for worker ${workerIndex}:`, error);
            });
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
