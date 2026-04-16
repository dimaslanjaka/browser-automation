import Bluebird from 'bluebird';
import minimist from 'minimist';
import { array_shuffle } from 'sbg-utility';
import { loadCsvData } from '../../../data/index.js';
import { LogDatabase } from '../../database/LogDatabase.js';
import { closeOtherTabs, getPuppeteer } from '../../puppeteer_utils.js';
import { processData } from '../../runner/skrin/direct-process-data.js';
import { skrinDatabase } from '../../runner/skrin/process.runner.js';
import { getNumbersOnly, noop } from '../../utils-browser.js';
import EndpointManager from './EndpointManager.js';
import { puppeteerTempPath } from '../../../.puppeteerrc.cjs';

async function main(opts: { loop?: boolean; max?: number }) {
  // instantiate endpoint manager and try to claim a free endpoint before connecting
  const endpointManager = new EndpointManager(puppeteerTempPath);
  let claimedEndpoint: string | undefined;
  let browser: import('puppeteer').Browser;

  const tried = new Set<string>();
  while (true) {
    const endpoint = await endpointManager.getAvailableEndpoint();
    if (!endpoint) {
      console.error('No browser endpoint available to connect.');
      process.exit(1);
    }

    if (tried.has(endpoint)) {
      // All known endpoints exhausted
      console.error('No free browser endpoint found after trying all endpoints.');
      process.exit(1);
    }

    // Try to claim it
    const claimed = endpointManager.tryClaimEndpoint(endpoint, process.pid);
    if (!claimed) {
      tried.add(endpoint);
      continue;
    }

    // Register cleanup after successful claim
    process.on('SIGINT', () => {
      endpointManager.releaseEndpointClaim(endpoint, process.pid);
      process.exit(0);
    });
    process.on('SIGTERM', () => {
      endpointManager.releaseEndpointClaim(endpoint, process.pid);
      process.exit(0);
    });
    process.on('exit', () => {
      endpointManager.releaseEndpointClaim(endpoint, process.pid);
    });

    try {
      // connect using existing helper which will use puppeteer.connect when browserWSEndpoint is provided
      const res = await getPuppeteer({ autoSwitchProfileDir: true, browserWSEndpoint: endpoint });
      browser = res.browser;
      res.page.goto('http://sh.webmanajemen.com').catch(noop);
      claimedEndpoint = endpoint;
      break;
    } catch (err: any) {
      // Release claim and remove dead endpoint if connection refused
      endpointManager.releaseEndpointClaim(endpoint, process.pid);
      tried.add(endpoint);
      const errObj = err?.error || err;
      if (errObj?.code === 'ECONNREFUSED') {
        endpointManager.removeEndpoint(endpoint);
      }
      // try next endpoint
      continue;
    }
  }

  browser.once('disconnected', async () => {
    if (claimedEndpoint) endpointManager.releaseEndpointClaim(claimedEndpoint, process.pid);
    console.log('Browser disconnected, exiting.');
    await closeOtherTabs(browser, 2);
    process.exit(0);
  });

  // close extra tabs if more than 2 are open (sometimes puppeteer.connect opens an extra blank tab)
  await closeOtherTabs(browser, 2);
  // open a new page and bring it to front (sometimes the connected browser doesn't have a page or the page is not focused)
  const page = await browser.newPage();
  page.goto('http://sh.webmanajemen.com').catch(noop);
  await page.bringToFront();

  const database = skrinDatabase;

  const dataKunto = await Bluebird.filter(await loadCsvData(), async (data) => {
    const existing = await database.getLogById(getNumbersOnly(data.nik));
    if (existing && existing.data) return false;
    return true;
  });

  if (!Array.isArray(dataKunto) || dataKunto.length === 0) {
    console.warn('No data available to process.');
    if (claimedEndpoint) endpointManager.releaseEndpointClaim(claimedEndpoint, process.pid);
    console.log('Leaving browser running. Exiting worker.');
    process.exit(0);
  }

  const items = array_shuffle(dataKunto);

  // Infer the options type from processData's parameter list
  type ProcessDataOptions = Parameters<typeof processData>[3];

  // Strongly infer types instead of using any
  type PageType = Awaited<ReturnType<typeof getPuppeteer>>['page'];
  type DataType = Awaited<ReturnType<typeof loadCsvData>>[number];

  // Read CLI overrides for processData options (undefined means not specified)
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

  // helper: resolve option value (removes repetition)
  function resolveOpt(value: boolean | undefined, fallback: boolean): boolean {
    return typeof value !== 'undefined' ? value : fallback;
  }

  // helper: build options once (removes duplication)
  function buildOptions(): ProcessDataOptions {
    return {
      skipValidateDb: resolveOpt(cliSkipValidateDb, false),
      skipCurrentMonthValidation: resolveOpt(cliSkipMonth, false),
      skipCurrentYearValidation: resolveOpt(cliSkipYear, false)
    };
  }

  // helper: process one item and normalize error/result handling
  async function processOne(
    page: PageType,
    data: DataType,
    databaseInstance: LogDatabase,
    options: ProcessDataOptions
  ) {
    const result = await processData(page, data, databaseInstance, options).catch((err) => {
      console.error('Error processing data:', err);
      return { status: 'error', error: err.message || String(err) };
    });

    return result;
  }

  if (opts.loop) {
    const max = typeof opts.max === 'number' && opts.max > 0 ? opts.max : Infinity;

    let processed = 0;

    for (const data of items) {
      if (processed >= max) break;

      processed++;
      console.log(`Processing item ${processed}${isFinite(max) ? `/${max}` : ''}`);

      // eslint-disable-next-line no-await-in-loop
      const result = await processOne(page, data, database, buildOptions());

      if (result.status !== 'success') {
        console.warn('Unexpected result status for item', processed, result);
        // continue processing next items instead of exiting to allow best-effort run
      } else {
        console.log('Processed:', result);
      }
    }

    if (claimedEndpoint) endpointManager.releaseEndpointClaim(claimedEndpoint, process.pid);
    console.log('Leaving browser running. Exiting worker.');
    process.exit(0);
  } else {
    const data = items.shift();

    if (!data) {
      console.warn('No item to process.');
      if (claimedEndpoint) endpointManager.releaseEndpointClaim(claimedEndpoint, process.pid);
      console.log('Leaving browser running. Exiting worker.');
      process.exit(0);
    }

    const result = await processOne(page, data, database, buildOptions());

    if (result.status !== 'success') {
      console.warn('Unexpected result status:', result.status, result);
      if (claimedEndpoint) endpointManager.releaseEndpointClaim(claimedEndpoint, process.pid);
      console.log('Leaving browser running due to unexpected status. Exiting worker with error.');
      process.exit(1); // exit on unexpected status to avoid silent failures
    } else {
      console.log(result);
      if (claimedEndpoint) endpointManager.releaseEndpointClaim(claimedEndpoint, process.pid);
      console.log('Leaving browser running. Exiting worker.');
      process.exit(0);
    }
  }
}

// CLI parsing
const argv = minimist(process.argv.slice(2), {
  boolean: ['loop', 'help', 'skip-validate-db', 'skip-current-month-validation', 'skip-current-year-validation'],
  alias: {
    l: 'loop',
    h: 'help',
    v: 'skip-validate-db',
    m: 'skip-current-month-validation',
    y: 'skip-current-year-validation'
  },
  default: { loop: false }
});

if (argv.help) {
  // simple help output (print line-by-line)
  const helpLines = [
    'Usage: node skrin [options]',
    '',
    'Options:',
    '  --loop, -l         Loop over available inputs (default: single input)',
    '  --max <n>          Maximum items to process when looping',
    '  --skip-validate-db, -v  Skip validation against DB (default: false)',
    '  --skip-current-month-validation, -m  Skip current month validation (default: false)',
    '  --skip-current-year-validation, -y   Skip current year validation (default: false)',
    '  --help, -h         Show this help message'
  ];
  helpLines.forEach((line) => console.log(line));
  process.exit(0);
}

const maxNum = argv.max ? Number(argv.max) : undefined;

main({
  loop: Boolean(argv.loop),
  max: Number.isFinite(maxNum) ? maxNum : undefined
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
