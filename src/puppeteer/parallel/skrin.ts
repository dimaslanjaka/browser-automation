import Bluebird from 'bluebird';
import puppeteer from 'puppeteer-extra';
import { array_shuffle } from 'sbg-utility';
import { loadCsvData } from '../../../data/index.js';
import { ExcelRowData } from '../../../globals.js';
import { closeOtherTabs } from '../../puppeteer_utils.js';
import type { ProcessDataResult } from '../../runner/skrin/direct-process-data.js';
import { processData } from '../../runner/skrin/direct-process-data.js';
import { skrinDatabase } from '../../runner/skrin/process.runner.js';
import { getNumbersOnly, noop } from '../../utils/browser.js';
import EndpointManager from './EndpointManager.js';

/**
 * Connects to an available browser endpoint, registers cleanup handlers,
 * and returns a ready-to-use page.
 */
async function getPage(): Promise<import('puppeteer').Page> {
  const endpointManager = new EndpointManager();
  const tried = new Set<string>();

  while (true) {
    const endpoint = await endpointManager.getAvailableEndpoint();
    if (!endpoint) {
      console.error('No free browser endpoint found after trying all endpoints.');
      process.exit(1);
    }

    if (tried.has(endpoint)) {
      console.warn(`Already tried endpoint ${endpoint}, skipping.`);
      continue;
    }

    if (!endpointManager.tryClaimEndpoint(endpoint, process.pid)) {
      tried.add(endpoint);
      continue;
    }

    const release = () => endpointManager.releaseEndpointClaim(endpoint, process.pid);
    process.on('SIGINT', () => {
      release();
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      release();
      process.exit(0);
    });
    process.on('exit', release);

    try {
      const browser = await puppeteer.connect({ browserWSEndpoint: endpoint });

      browser.once('disconnected', async () => {
        release();
        console.log('Browser disconnected, exiting.');
        await closeOtherTabs(browser, 2);
        process.exit(0);
      });

      await closeOtherTabs(browser, 2);
      const page = await browser.newPage();
      page.goto('http://sh.webmanajemen.com').catch(noop);
      await page.bringToFront();

      return page;
    } catch (err: any) {
      release();
      tried.add(endpoint);
      if ((err?.error ?? err)?.code === 'ECONNREFUSED') {
        endpointManager.removeEndpoint(endpoint);
      }
    }
  }
}

export async function parallelSkrin(opts: { loop?: boolean; max?: number; argv: Record<string, any> }) {
  const page = await getPage();
  const argv = opts.argv;
  const cliSkipValidateDb =
    typeof argv['skip-validate-db'] !== 'undefined' ? Boolean(argv['skip-validate-db']) : undefined;
  const cliSkipMonth =
    typeof argv['skip-current-month-validation'] !== 'undefined'
      ? Boolean(argv['skip-current-month-validation'])
      : undefined;
  const cliSkipYear =
    typeof argv['skip-current-year-validation'] !== 'undefined'
      ? Boolean(argv['skip-current-year-validation'])
      : undefined;

  let dataKunto: ExcelRowData[];
  if (cliSkipValidateDb) {
    dataKunto = await loadCsvData<ExcelRowData>();
  } else {
    dataKunto = await Bluebird.filter(await loadCsvData<ExcelRowData>(), async (data) => {
      const existing = await skrinDatabase.getLogById(getNumbersOnly(data.nik));
      return !(existing && existing.data);
    });
  }

  function exitWorker(code = 0): never {
    console.log('Leaving browser running. Exiting worker.');
    if (dataKunto.length > 0) {
      console.log(`Data left: ${dataKunto.length} item(s)`);
    }
    process.exit(code);
  }

  if (!Array.isArray(dataKunto) || dataKunto.length === 0) {
    console.warn('No data available to process.');
    exitWorker(0);
  }

  const options: Parameters<typeof processData>[3] = {
    skipValidateDb: cliSkipValidateDb ?? false,
    skipCurrentMonthValidation: cliSkipMonth ?? false,
    skipCurrentYearValidation: cliSkipYear ?? false
  };

  async function processOne(data: ExcelRowData): Promise<ProcessDataResult> {
    return processData(page, data, skrinDatabase, options).catch((err) => ({
      status: 'error' as const,
      reason: 'process_data_exception',
      description: err instanceof Error ? err.message : String(err)
    }));
  }

  if (opts.loop) {
    const max = typeof opts.max === 'number' && opts.max > 0 ? opts.max : Infinity;
    let processed = 0;

    for (const data of array_shuffle(dataKunto)) {
      if (processed >= max) break;
      processed++;
      console.log(`Processing item ${processed}${isFinite(max) ? `/${max}` : ''}`);

      const result = await processOne(data);
      if (result.status !== 'success') {
        console.warn('Unexpected result status for item', processed, result);
      } else {
        console.log('Processed:', result);
      }
    }

    exitWorker(0);
  } else {
    const data = dataKunto.shift();

    if (!data) {
      console.warn('No item to process.');
      exitWorker(0);
    }

    const result = await processOne(data);

    if (result.status !== 'success') {
      console.warn('Unexpected result status:', result.status, result);
      console.log('Leaving browser running due to unexpected status. Exiting worker with error.');
      exitWorker(1);
    }

    console.log(result);
    exitWorker(0);
  }
}

export default parallelSkrin;
