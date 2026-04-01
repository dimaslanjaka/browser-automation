import Bluebird from 'bluebird';
import minimist from 'minimist';
import { array_shuffle } from 'sbg-utility';
import { loadCsvData } from '../../../data/index.js';
import { LogDatabase } from '../../database/LogDatabase.js';
import { toValidMySQLDatabaseName } from '../../database/db_utils.js';
import { closeOtherTabs, getPuppeteer } from '../../puppeteer_utils.js';
import { processData } from '../../runner/skrin/direct-process-data.js';
import { getNumbersOnly } from '../../utils-browser.js';
import { getAvailableEndpoint } from './utils.js';

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

async function main(opts: { loop?: boolean; max?: number }) {
  const wsEndpoint = getAvailableEndpoint();
  const { page, browser } = await getPuppeteer({
    autoSwitchProfileDir: true,
    browserWSEndpoint: wsEndpoint
  });

  await closeOtherTabs(browser, 2);
  await page.bringToFront();

  browser.once('disconnected', () => {
    console.log('Browser disconnected, exiting.');
    process.exit(0);
  });

  const dataKunto = await Bluebird.filter(await loadCsvData(), async (data) => {
    const existing = await database.getLogById(getNumbersOnly(data.nik));
    if (existing && existing.data) return false;
    return true;
  });

  if (!Array.isArray(dataKunto) || dataKunto.length === 0) {
    console.warn('No data available to process.');
    await browser.close();
    process.exit(0);
  }

  const items = array_shuffle(dataKunto);

  // Infer the options type from processData's parameter list
  type ProcessDataOptions = Parameters<typeof processData>[3];

  // Strongly infer types instead of using any
  type PageType = Awaited<ReturnType<typeof getPuppeteer>>['page'];
  type DataType = Awaited<ReturnType<typeof loadCsvData>>[number];

  // Read CLI overrides for processData options (undefined means not specified)
  const cliValidateDb = typeof argv['validate-db'] !== 'undefined' ? Boolean(argv['validate-db']) : undefined;
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
  function buildOptions(isLoop: boolean): ProcessDataOptions {
    return {
      validateDb: resolveOpt(cliValidateDb, isLoop ? true : false),
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
      const result = await processOne(page, data, database, buildOptions(true));

      if (result.status !== 'success') {
        console.warn('Unexpected result status for item', processed, result);
        // continue processing next items instead of exiting to allow best-effort run
      } else {
        console.log('Processed:', result);
      }
    }

    await browser.close();
    process.exit(0);
  } else {
    const data = items.shift();

    if (!data) {
      console.warn('No item to process.');
      await browser.close();
      process.exit(0);
    }

    const result = await processOne(page, data, database, buildOptions(false));

    if (result.status !== 'success') {
      console.warn('Unexpected result status:', result.status, result);
      await browser.close();
      process.exit(1); // exit on unexpected status to avoid silent failures
    } else {
      console.log(result);
      await browser.close();
      process.exit(0);
    }
  }
}

// CLI parsing
const argv = minimist(process.argv.slice(2), {
  boolean: ['loop', 'help', 'validate-db', 'skip-current-month-validation', 'skip-current-year-validation'],
  alias: {
    l: 'loop',
    h: 'help',
    v: 'validate-db',
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
    '  --validate-db, -v  Enable validation against DB (overrides default)',
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
