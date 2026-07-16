import Bluebird from 'bluebird';
import minimist from 'minimist';
import type { Page } from 'puppeteer';
import { Cluster } from 'puppeteer-cluster';
import { loadCsvData } from '../../data/index.js';
import type { ExcelRowData } from '../../globals.js';
import { createSkrinDatabase } from '../database/shared.js';
import { closeOtherTabs, getPuppeteerCluster } from '../puppeteer_utils.js';
import { getNumbersOnly } from '../utils/index.js';
import { processData } from './skrin/direct-process-data.js';

const cliArgs = minimist(process.argv.slice(2), {
  boolean: ['single', 'shuffle'],
  string: ['concurrent'],
  alias: {
    s: 'single',
    sh: 'shuffle',
    c: 'concurrent'
  }
});

const database = createSkrinDatabase();

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
      const dataKunto = await Bluebird.filter((await loadCsvData<ExcelRowData>()) as ExcelRowData[], async (data) => {
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
              const result = await processData(page, data, database, { skipValidateDb: false });
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
