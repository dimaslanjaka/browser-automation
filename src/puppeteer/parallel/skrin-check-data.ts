import Bluebird from 'bluebird';
import moment from 'moment';
import { fs, writefile } from 'sbg-utility';
import path from 'upath';
import { puppeteerTempPath } from '../../../.puppeteerrc.cjs';
import { loadCsvData } from '../../../data/index.js';
import { ExcelRowData } from '../../../globals.js';
import puppeteer from 'puppeteer';
import { closeOtherTabs, maximizeWindow, pageScreenshot, typeAndTrigger } from '../../puppeteer_utils.js';
import { skrinDatabase } from '../../runner/skrin/process.runner.js';
import { autoLoginAndEnterSkriningPage } from '../../skrin_puppeteer.js';
import { getNumbersOnly, sleep } from '../../utils/browser.js';
import { imageFileToDataUrl, openImageExternally } from '../../utils/image.js';
import { decryptJson, encryptJson } from '../../utils/json-crypto.js';
import md5 from '../../utils/md5.js';
import { isValidNik } from '../../utils/xlsx/fixData.js';
import EndpointManager from './EndpointManager.js';

const IMAGE_DATABASE_PATH = 'tmp/screenshot/metadata.bin';
const IMAGE_DATABASE: Record<string, string> = fs.existsSync(IMAGE_DATABASE_PATH)
  ? decryptJson(fs.readFileSync(IMAGE_DATABASE_PATH, 'utf-8'), process.env.VITE_JSON_SECRET)
  : {};

const endpointManager = new EndpointManager(puppeteerTempPath);
let claimedEndpoint: string | undefined;
export { endpointManager as parallelSkrinCheckEndpointManager, claimedEndpoint as parallelSkrinCheckClaimedEndpoint };
let browser: import('puppeteer').Browser;

export async function parallelSkrinCheck(options?: {
  specificNiks?: string[];
  force?: boolean;
  openScreenshots?: boolean;
}) {
  const opts = { specificNiks: [] as string[], force: false, openScreenshots: false, ...options };
  const { specificNiks, force, openScreenshots } = opts;
  const normalizedTargets = specificNiks.map(getNumbersOnly);
  const tried = new Set<string>();

  while (true) {
    const endpoint = await endpointManager.getAvailableEndpoint();
    if (!endpoint) {
      console.error('No browser endpoint available.');
      process.exit(1);
    }

    if (tried.has(endpoint)) {
      console.error('No free endpoint found.');
      process.exit(1);
    }

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
      browser = await puppeteer.connect({
        browserWSEndpoint: endpoint
      });
      claimedEndpoint = endpoint;
      break;
    } catch {
      endpointManager.releaseEndpointClaim(endpoint, process.pid);
      tried.add(endpoint);
    }
  }

  browser.once('disconnected', async () => {
    if (claimedEndpoint) {
      endpointManager.releaseEndpointClaim(claimedEndpoint, process.pid);
    }
    await closeOtherTabs(browser, 2);
    process.exit(0);
  });

  await closeOtherTabs(browser, 2);
  const page = await browser.newPage();
  await page.bringToFront();

  const database = skrinDatabase;

  const dataKunto: ExcelRowData[] = await Bluebird.filter(
    (await loadCsvData<ExcelRowData>()) as ExcelRowData[],
    async (data: ExcelRowData) => {
      const existing = await database.getLogById(getNumbersOnly(data.nik));
      return !!existing;
    }
  );

  let toProcess: ExcelRowData[];

  // ✅ MULTI NIK MODE
  if (normalizedTargets.length > 0) {
    toProcess = dataKunto.filter((d) => normalizedTargets.includes(getNumbersOnly(d.nik)));

    const foundSet = new Set(toProcess.map((d) => getNumbersOnly(d.nik)));
    const missing = normalizedTargets.filter((n) => !foundSet.has(n));

    if (missing.length > 0) {
      console.warn('Some NIK not found in CSV, using manual input:', missing);
      for (const nik of missing) {
        const fallbackRow = dataKunto[0] as ExcelRowData;
        toProcess.push({ ...fallbackRow, nik: String(nik) });
      }
    }
  } else if (force) {
    toProcess = dataKunto;
  } else {
    const filterValidNik = dataKunto.filter((data) => isValidNik(data.nik));
    const dataNotInImageDb = filterValidNik.filter((data) => data.nik && data.nik !== '' && !IMAGE_DATABASE[data.nik]);
    toProcess = dataNotInImageDb;
  }

  console.log(`Total data to process: ${toProcess.length}`);

  for (const data of toProcess) {
    await findData(data, page, { normalizedTargets, openScreenshots });
  }

  // Intentionally keep the browser running (do not close it) so it can be inspected.
  if (claimedEndpoint) endpointManager.releaseEndpointClaim(claimedEndpoint, process.pid);

  process.exit(0);
}

let lastLoginTime = 0;

async function findData(
  data: ExcelRowData,
  page: import('puppeteer').Page,
  options?: { normalizedTargets?: string[]; openScreenshots?: boolean }
) {
  const now = Date.now();

  if (!page || page.isClosed()) return;

  if (!page.url().includes('/skrining') || now - lastLoginTime > 10 * 60 * 1000) {
    await autoLoginAndEnterSkriningPage(page);
    lastLoginTime = now;
  }

  await page.goto('https://sumatera.sitb.id/sitb2024/skrining', {
    waitUntil: 'networkidle0'
  });

  await page.waitForSelector('#nik_peserta', { visible: true });

  await page.evaluate((nik) => {
    const input = document.getElementById('nik_peserta') as HTMLInputElement | null;
    if (input) {
      input.value = nik;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, data.nik);

  const fromDate = `01/${String(moment().month() + 1).padStart(2, '0')}/${moment().year()}`;
  const toDate = moment().format('DD/MM/YYYY');

  await typeAndTrigger(page, '#from_tgl_skrining', fromDate);
  await typeAndTrigger(page, '#to_tgl_skrining', toDate);

  await page.click('#btnCari');

  await page.waitForSelector('#grid_ta_skrining', { visible: true });

  await page.waitForFunction(() => {
    const tbody = document.querySelector('#grid_ta_skrining tbody');
    return tbody && tbody.querySelectorAll('tr').length > 0;
  });

  // Save real image to tmp for inspection
  const tmpScreenshotDir = path.join(process.cwd(), 'tmp', 'screenshot');
  const tmpFilename = `${md5(data.nik)}.jpg`;
  const tmpFilePath = path.join(tmpScreenshotDir, tmpFilename);
  // Maximize window and set viewport to available screen size
  await maximizeWindow(page);
  await sleep(1000); // Wait for resize to take effect
  await pageScreenshot(page, {
    path: tmpFilePath,
    selector: '#grid_ta_skrining',
    type: 'jpeg',
    quality: 70
  });
  await sleep(500); // Ensure file is fully written

  console.log(`Screenshot saved: ${path.relative(process.cwd(), tmpFilePath)}`);
  const { normalizedTargets = [], openScreenshots = false } = options || {};
  if (openScreenshots) {
    console.log('Opening image with default viewer...');
    await openImageExternally(tmpFilePath);
  }

  // overwrite only targeted NIKs
  if (normalizedTargets.length > 0 && normalizedTargets.includes(getNumbersOnly(data.nik))) {
    delete IMAGE_DATABASE[data.nik];
  }

  // Convert the saved JPEG to a data URI, encrypt it, and write per-image .bin file
  try {
    const uri = imageFileToDataUrl(tmpFilePath);
    const outDir = path.join(process.cwd(), 'public', 'assets', 'data', 'screenshots');
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
    const outFilename = `${md5(data.nik)}.bin`;
    const outPath = path.join(outDir, outFilename);
    const tmpOut = path.join(process.cwd(), 'tmp', `${md5(data.nik)}-${process.pid}.bin`);
    writefile(tmpOut, encryptJson(uri, process.env.VITE_JSON_SECRET));
    fs.renameSync(tmpOut, outPath);
    IMAGE_DATABASE[data.nik] = `/assets/data/screenshots/${outFilename}`;
  } catch {
    // Fallback: store the tmp jpeg as a public asset path
    IMAGE_DATABASE[data.nik] = `/tmp/screenshot/${tmpFilename}`;
  }

  const tmpPath = path.join(process.cwd(), 'tmp', `${md5(data.nik)}-${process.pid}.json`);
  writefile(tmpPath, encryptJson(IMAGE_DATABASE, process.env.VITE_JSON_SECRET));
  fs.renameSync(tmpPath, IMAGE_DATABASE_PATH);
}
