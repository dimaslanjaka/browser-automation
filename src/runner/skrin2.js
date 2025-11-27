import ansiColors from 'ansi-colors';
import 'dotenv/config';
import minimist from 'minimist';
import * as nikUtils from 'nik-parser-jurusid/index';
import { loadCsvData } from '../../data/index.js';
import { addLog, getLogById } from '../database/SQLiteLogDatabase.js';
import { getPuppeteer } from '../puppeteer_utils.js';
import { skrinLogin } from '../skrin_puppeteer.js';
import { getNumbersOnly, logLine } from '../utils.js';
import { parseBabyName } from './skrin-utils.js';
import { processData } from './skrin-process-data.js';

console.clear();

const cliArgs = minimist(process.argv.slice(2), {
  boolean: ['help', 'shuffle'],
  alias: {
    h: 'help',
    sh: 'shuffle',
    s: 'single'
  }
});

function showHelp() {
  console.log(`
    Usage: node skrin2.js [options]

    Options:
      -h, --help        Show help
      -sh, --shuffle    Shuffle the data
      -s, --single      Process a single data entry
  `);
}

async function _testSkriningData() {
  const dataKunto = await loadCsvData();
  console.log(dataKunto[0]);
  console.log('total data:', dataKunto.length);
}

const _main = async () => {
  const { page, browser } = await getPuppeteer();
  await skrinLogin(page);
  /**
   * @type {import('./types.js').SkrinData[]}
   */
  const dataKunto = await loadCsvData();

  // Fix data names
  for (let i = 0; i < dataKunto.length; i++) {
    if (/bayi/i.test(dataKunto[i].nama)) {
      const namaBayi = parseBabyName(dataKunto[i].nama);
      if (namaBayi) {
        logLine(`Parsed baby name: ${dataKunto[i].nama} -> ${ansiColors.green(namaBayi)}`);
        dataKunto[i].nama = namaBayi;
      } else {
        logLine(`Failed to parse baby name: ${dataKunto[i].nama}`);
        // dataKunto[i].skip = true; // Mark to skip
      }
    }
  }

  if (cliArgs.shuffle) {
    // Shuffle data array using Fisher-Yates algorithm
    for (let i = dataKunto.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dataKunto[i], dataKunto[j]] = [dataKunto[j], dataKunto[i]];
    }
    logLine('Data shuffled');
  }

  const unprocessedData = dataKunto.filter((item) => {
    // Check if the data for this NIK has already been processed
    const nik = getNumbersOnly(item.nik);
    return !getLogById(nik) || Object.hasOwn(getLogById(nik).data, 'status') === false;
  });

  const isSingle = cliArgs.single ? true : false;

  if (!isSingle) {
    while (unprocessedData.length > 0) {
      const currentData = unprocessedData.shift();
      if (currentData.skip) {
        continue; // Skip this entry
      }
      if (!nikUtils.isValidNIK(currentData.nik)) {
        logLine(`Skipping invalid NIK: ${currentData.nik}`);
        addLog({
          id: getNumbersOnly(currentData.nik),
          data: { ...currentData, status: 'invalid' },
          message: 'Invalid NIK format'
        });
        continue; // Skip invalid NIKs
      }
      // Close the first page if there are more than 3 pages open
      if ((await browser.pages()).length > 3) {
        const pages = await browser.pages();
        await pages[0].close();
      }
      // Start new page for each data entry
      if (currentData) await processData(await browser.newPage(), currentData);
      // Log remaining unprocessed data count
      logLine(`Remaining unprocessed data: ${unprocessedData.length}`);
    }
  } else {
    // Single mode - process only the first unprocessed data
    if (unprocessedData.length > 0) {
      const currentData = unprocessedData[0];
      if (currentData.skip) {
        logLine('The first unprocessed data is marked to skip. Exiting single mode.');
      } else if (!nikUtils.isValidNIK(currentData.nik)) {
        logLine(`Skipping invalid NIK: ${currentData.nik}`);
        addLog({
          id: getNumbersOnly(currentData.nik),
          data: { ...currentData, status: 'invalid' },
          message: 'Invalid NIK format'
        });
      } else {
        await processData(page, currentData);
      }
    } else {
      logLine('No unprocessed data available for single mode.');
    }
  }
};

if (cliArgs.help) {
  showHelp();
  process.exit(0);
} else {
  (async () => {
    try {
      await _main();
      logLine('All done!');
      process.exit(0);
    } catch (err) {
      console.error('Fatal error:', err);
      process.exit(1);
    }
  })();
}
