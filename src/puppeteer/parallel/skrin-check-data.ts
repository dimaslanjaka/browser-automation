import Bluebird from 'bluebird';
import minimist from 'minimist';
import moment from 'moment';
import { array_shuffle, fs, md5, writefile } from 'sbg-utility';
import path from 'upath';
import { puppeteerTempPath } from '../../../.puppeteerrc.cjs';
import { loadCsvData } from '../../../data/index.js';
import { ExcelRowData } from '../../../globals.js';
import { closeOtherTabs, getPuppeteer, pageScreenshot, typeAndTrigger } from '../../puppeteer_utils.js';
import { skrinDatabase } from '../../runner/skrin/process.runner.js';
import { autoLoginAndEnterSkriningPage } from '../../skrin_puppeteer.js';
import { getNumbersOnly, noop } from '../../utils-browser.js';
import { imageFileToDataUrl } from '../../utils/image.js';
import { decryptJson, encryptJson } from '../../utils/json-crypto.js';
import EndpointManager from './EndpointManager.js';
import { isValidNik } from '../../utils/xlsx/fixData.js';

const IMAGE_DATABASE_PATH = 'public/assets/data/screenshot.json';
const IMAGE_DATABASE: Record<string, string> = fs.existsSync(IMAGE_DATABASE_PATH)
  ? decryptJson(fs.readFileSync(IMAGE_DATABASE_PATH, 'utf-8'), process.env.VITE_JSON_SECRET)
  : {};

const argv = minimist(process.argv.slice(2), {
  string: ['id'],
  boolean: ['force', 'help'],
  alias: {
    i: 'id',
    f: 'force',
    h: 'help'
  },
  default: { force: false, id: '' }
});
const checkId = argv.id || '';
const force = argv.force;

// Show help and exit if --help or -h is passed
if (argv.help) {
  const helpLines = [
    'Usage: node skrin-check-data [options]',
    '',
    'Options:',
    '  --id, -i <id>      Set custom screenshot ID suffix',
    '  --force, -f        Process all data, ignore filters',
    '  --help, -h         Show this help message',
    '',
    'Examples:',
    '  node skrin-check-data --id=test',
    '  node skrin-check-data -f',
    '  node skrin-check-data -i test -f'
  ];
  helpLines.forEach((line) => console.log(line));
  process.exit(0);
}

if (checkId.length > 0) {
  console.log('Checking data for ID:', checkId);
}

if (force) {
  console.log('Force mode enabled: all data will be processed.');
}

async function main() {
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
  // Maximize window
  const windowId = await page.windowId();
  await browser.setWindowBounds(windowId, { windowState: 'maximized' });
  const { width, height } = browser.wsEndpoint
    ? { width: 1920, height: 1080 }
    : await page.evaluate(() => ({ width: window.screen.availWidth, height: window.screen.availHeight }));
  await page.setViewport({ width, height });
  page.goto('http://sh.webmanajemen.com').catch(noop);
  await page.bringToFront();

  const database = skrinDatabase;

  const dataKunto = array_shuffle(
    await Bluebird.filter(await loadCsvData<ExcelRowData>(), async (data) => {
      const existing = await database.getLogById(getNumbersOnly(data.nik));
      // only include if log exists
      return !!existing;
    })
  );

  await autoLoginAndEnterSkriningPage(page);

  let toProcess: ExcelRowData[];
  if (force) {
    toProcess = dataKunto;
  } else {
    const filterValidNik = dataKunto.filter((data) => isValidNik(data.nik));
    const dataNotInImageDb = filterValidNik.filter((data) => !IMAGE_DATABASE[data.nik]);
    toProcess = dataNotInImageDb;
  }
  console.log(`Total data to process: ${toProcess.length}`);
  for (const data of toProcess) {
    await findData(data, page, force);
  }

  // exit the process after 5 seconds to allow any pending operations to complete
  setTimeout(() => {
    process.exit(0);
  }, 5000);
}

async function findData(data: ExcelRowData, page: import('puppeteer').Page, force = false) {
  await page.goto('https://sumatera.sitb.id/sitb2024/skrining', { waitUntil: 'networkidle0' });
  // Fill the NIK input field with data.nik
  await page.waitForSelector('#nik_peserta', { visible: true });
  await page.evaluate((nik) => {
    const input = document.getElementById('nik_peserta') as HTMLInputElement | null;
    if (input) {
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.value = nik;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, data.nik);

  const currentMonth = String(moment().month() + 1).padStart(2, '0');
  const currentYear = moment().year();
  const fromDate = `01/${currentMonth}/${currentYear}`;
  const toDate = moment().format('DD/MM/YYYY');
  console.log(`Searching for NIK: ${data.nik} with date range ${fromDate} - ${toDate}`);
  // insert date DD/MM/YYYY to #from_tgl_skrining
  await page.waitForSelector('#from_tgl_skrining', { visible: true });
  await typeAndTrigger(page, '#from_tgl_skrining', fromDate);
  // insert date DD/MM/YYYY to #to_tgl_skrining
  await page.waitForSelector('#to_tgl_skrining', { visible: true });
  await typeAndTrigger(page, '#to_tgl_skrining', toDate);

  // click #btnCari
  await page.waitForSelector('#btnCari', { visible: true });
  await page.click('#btnCari');

  // Wait for #grid_ta_skrining to be visible and have at least one row in tbody (data loaded)
  await page.waitForSelector('#grid_ta_skrining', { visible: true });
  await page.waitForFunction(() => {
    const grid = document.querySelector('#grid_ta_skrining');
    if (!grid) return false;
    const tbody = grid.querySelector('tbody');
    if (!tbody) return false;
    return tbody.querySelectorAll('tr').length > 0;
  });

  // screenshot #grid_ta_skrining element using pageScreenshot util
  const tempDir = path.join(process.cwd(), 'tmp/screenshot');
  const filePath =
    checkId.length > 0
      ? path.join(tempDir, `${md5(data.nik)}-${checkId}.png`)
      : path.join(tempDir, `${md5(data.nik)}.png`);
  if (!fs.existsSync(filePath) || force) {
    await pageScreenshot(page, {
      path: filePath,
      selector: '#grid_ta_skrining'
    });
    console.log(`Screenshot saved: ${filePath}`);
    const uri = imageFileToDataUrl(filePath);
    IMAGE_DATABASE[data.nik] = uri;
    // Atomic write: write to temp file then rename to avoid truncation/race condition
    const tmpPath = path.join(tempDir, `${md5(data.nik)}-${process.pid}.json`);
    writefile(tmpPath, encryptJson(IMAGE_DATABASE, process.env.VITE_JSON_SECRET));
    fs.renameSync(tmpPath, IMAGE_DATABASE_PATH);
  }
}

if (process.argv.some((arg) => arg.includes('skrin-check-data'))) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
