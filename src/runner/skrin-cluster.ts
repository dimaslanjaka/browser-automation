import Bluebird from 'bluebird';
import dotenv from 'dotenv';
import minimist from 'minimist';
import path from 'path';
import type { Page } from 'puppeteer';
import { Cluster } from 'puppeteer-cluster';
import { fileURLToPath } from 'url';
import { loadCsvData } from '../../data/index.js';
import type { ExcelRowData } from '../../globals.js';
import { LogDatabase } from '../database/LogDatabase.js';
import { toValidMySQLDatabaseName } from '../database/db_utils.js';
import { closeOtherTabs, getPuppeteerCluster } from '../puppeteer_utils.js';
import { autoLoginAndEnterSkriningPage } from '../skrin_puppeteer.js';
import { processData } from './skrin/direct-process-data.js';
import { getNumbersOnly } from '../utils.js';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cliArgs = minimist(process.argv.slice(2), {
  boolean: ['single', 'shuffle'],
  string: ['concurrent'],
  alias: {
    s: 'single',
    sh: 'shuffle',
    c: 'concurrent'
  }
});

const { MYSQL_HOST, MYSQL_USER, MYSQL_PASS, MYSQL_PORT } = process.env;
const database = new LogDatabase(toValidMySQLDatabaseName('skrin_' + process.env.DATABASE_FILENAME), {
  connectTimeout: 60000,
  connectionLimit: 10,
  host: MYSQL_HOST || 'localhost',
  user: MYSQL_USER || 'root',
  password: MYSQL_PASS || '',
  port: Number(MYSQL_PORT) || 3306,
  type: MYSQL_HOST ? 'mysql' : 'sqlite'
});

async function main() {
  const defaultMaxConcurrency = 2;
  const parsedConcurrency = Number(cliArgs.concurrent);
  const hasValidConcurrentArg = Number.isInteger(parsedConcurrency) && parsedConcurrency > 0;
  const maxConcurrency = hasValidConcurrentArg ? parsedConcurrency : defaultMaxConcurrency;

  if (cliArgs.concurrent !== undefined && !hasValidConcurrentArg) {
    console.warn(
      `Invalid --concurrent value: ${String(cliArgs.concurrent)}. Falling back to ${defaultMaxConcurrency}.`
    );
  }

  const { cluster, puppeteer: _ } = await getPuppeteerCluster({
    concurrency: Cluster.CONCURRENCY_CONTEXT, // 1 tab per worker
    maxConcurrency, // ⬅ cuma [n] tab maksimal
    timeout: 30 * 60 * 1000 // 30 menit timeout per task
  });

  try {
    while (true) {
      const dataKunto = await Bluebird.filter((await loadCsvData()) as ExcelRowData[], async (data) => {
        const existing = await database.getLogById(getNumbersOnly(data.nik));
        if (existing && existing.data) return false;
        return true;
      });

      if (dataKunto.length === 0) {
        console.log('No unprocessed data found. Stopping worker loop.');
        break;
      }

      if (cliArgs.shuffle) {
        for (let i = dataKunto.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [dataKunto[i], dataKunto[j]] = [dataKunto[j], dataKunto[i]];
        }
        console.log('Data shuffled');
      }

      const dataToProcess = cliArgs.single ? dataKunto.slice(0, 1) : dataKunto;

      console.log(`Processing ${dataToProcess.length} item(s) with max concurrency ${maxConcurrency}...`);

      await Bluebird.map(
        dataToProcess,
        async (data) => {
          const existing = await database.getLogById(getNumbersOnly(data.nik));
          if (existing && existing.data) {
            console.log(`Skipping already processed NIK: ${data.nik}`);
            return;
          }

          await cluster.execute(data, async ({ page, data }: { page: Page; data: ExcelRowData }) => {
            try {
              await closeOtherTabs(page);
              await autoLoginAndEnterSkriningPage(page);
              const result = await processData(page, data, database);
              if (result.status === 'error') {
                console.error('Error processing data:', {
                  error: result.reason || 'Unknown error',
                  data,
                  result
                });
              } else if (result.status === 'success') {
                console.log('Data processed successfully:', result.data);
              } else {
                console.warn('Unexpected result status:', (result as any).status, result);
              }
            } catch (error) {
              console.error('Exception while processing data:', { error, data });
            }
          });
        },
        { concurrency: maxConcurrency }
      );

      await cluster.idle();

      if (cliArgs.single) {
        console.log('Single mode enabled. Processed one item and exiting.');
        break;
      }

      console.log('Cycle finished. Refreshing unprocessed data...');
    }
  } finally {
    await cluster.close();
    await database.close();
  }
}

main().catch(console.error);
