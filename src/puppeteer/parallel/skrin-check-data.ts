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

// Build the local JPEG path from the NIK so tmp screenshots can be reused.
function getTmpScreenshotPath(nik: string) {
  return path.join(process.cwd(), 'tmp', 'screenshot', `${md5(nik)}.jpg`);
}

// Resolve the published encrypted asset path stored in IMAGE_DATABASE.
function getPublishedScreenshotPath(nik: string) {
  const imagePath = IMAGE_DATABASE[nik];
  if (!imagePath || !imagePath.startsWith('/assets/data/screenshots/')) return undefined;

  return path.join(process.cwd(), 'public', imagePath);
}

// Convert a tmp JPEG to an encrypted public .bin asset and update the in-memory index.
function publishScreenshotFromTmp(data: ExcelRowData, tmpFilePath: string) {
  const outDir = path.join(process.cwd(), 'public', 'assets', 'data', 'screenshots');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const outFilename = `${md5(data.nik)}.bin`;
  const outPath = path.join(outDir, outFilename);
  const tmpOut = path.join(process.cwd(), 'tmp', `${md5(data.nik)}-${process.pid}.bin`);
  const uri = imageFileToDataUrl(tmpFilePath);

  writefile(tmpOut, encryptJson(uri, process.env.VITE_JSON_SECRET));
  fs.renameSync(tmpOut, outPath);
  IMAGE_DATABASE[data.nik] = `/assets/data/screenshots/${outFilename}`;
}

/**
 * Core scraping function
 */
let lastLoginTime = 0;

/**
 * Fetches and saves a screening screenshot for a single NIK.
 *
 * @param data The row to process.
 * @param page The active Puppeteer page.
 * @param options Processing options for custom NIKs and opening screenshots.
 * @returns A promise that resolves when the screenshot has been captured and persisted.
 */
async function findData(
  data: ExcelRowData,
  page: import('puppeteer').Page,
  options?: { normalizedTargets?: string[]; openScreenshots?: boolean; fromDate?: string; toDate?: string }
) {
  const now = Date.now();
  if (!page || page.isClosed()) {
    throw new Error('Puppeteer page is not available');
  }

  // Reuse the tmp JPEG path for this NIK when taking a fresh screenshot.
  const tmpFilePath = getTmpScreenshotPath(data.nik);

  // Refresh login if the page is stale or the session is old.
  if (!page.url().includes('/skrining') || now - lastLoginTime > 10 * 60 * 1000) {
    await autoLoginAndEnterSkriningPage(page);
    lastLoginTime = now;
  }

  // Navigate to the screening page and fill the NIK and date range fields.
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

  const fromDate = options?.fromDate ?? `01/${String(moment().month() + 1).padStart(2, '0')}/${moment().year()}`;
  const toDate = options?.toDate ?? moment().format('DD/MM/YYYY');

  await typeAndTrigger(page, '#from_tgl_skrining', fromDate);
  await typeAndTrigger(page, '#to_tgl_skrining', toDate);

  await page.click('#btnCari');

  await page.waitForSelector('#grid_ta_skrining', { visible: true });

  await page.waitForFunction(() => {
    const tbody = document.querySelector('#grid_ta_skrining tbody');
    return tbody && tbody.querySelectorAll('tr').length > 0;
  });

  await maximizeWindow(page);
  await sleep(1000);

  await pageScreenshot(page, {
    path: tmpFilePath,
    selector: '#grid_ta_skrining',
    type: 'jpeg',
    quality: 70
  });

  await sleep(500);

  console.log(`Screenshot saved: ${path.relative(process.cwd(), tmpFilePath)}`);

  const { normalizedTargets = [], openScreenshots = false } = options || {};

  if (openScreenshots) {
    await openImageExternally(tmpFilePath);
  }

  if (normalizedTargets.length > 0 && normalizedTargets.includes(getNumbersOnly(data.nik))) {
    delete IMAGE_DATABASE[data.nik];
  }

  try {
    publishScreenshotFromTmp(data, tmpFilePath);
  } catch {
    IMAGE_DATABASE[data.nik] = `/tmp/screenshot/${path.basename(tmpFilePath)}`;
  }

  const tmpPath = path.join(process.cwd(), 'tmp', `${md5(data.nik)}-${process.pid}.json`);
  writefile(tmpPath, encryptJson(IMAGE_DATABASE, process.env.VITE_JSON_SECRET));
  fs.renameSync(tmpPath, IMAGE_DATABASE_PATH);
}

const endpointManager = new EndpointManager(puppeteerTempPath);

let claimedEndpoint: string | undefined;
let browser: import('puppeteer').Browser;

/**
 * Processes screening data, reusing existing screenshots when possible and fetching new ones when needed.
 */
export async function parallelSkrinCheck(options?: {
  specificNiks?: string[];
  force?: boolean;
  openScreenshots?: boolean;
  limit?: number;
  fromDate?: string;
  toDate?: string;
}) {
  const opts = {
    specificNiks: [] as string[],
    force: false,
    openScreenshots: false,
    fromDate: undefined as string | undefined,
    toDate: undefined as string | undefined,
    ...options
  };

  const { specificNiks, force, openScreenshots, limit, fromDate, toDate } = opts;

  const normalizedTargets: string[] = specificNiks.map(getNumbersOnly);
  const tried = new Set<string>();

  if (normalizedTargets.length > 0) {
    console.log('Specific NIK mode:', normalizedTargets.join(', '));
  }

  if (force) {
    console.log('Force mode enabled: all data will be processed.');
  }

  while (true) {
    const endpoint = await endpointManager.getAvailableEndpoint();
    if (!endpoint) process.exit(1);

    if (tried.has(endpoint)) process.exit(1);

    const claimed = endpointManager.tryClaimEndpoint(endpoint, process.pid);
    if (!claimed) {
      tried.add(endpoint);
      continue;
    }

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

  const csvData = (await loadCsvData<ExcelRowData>()) as ExcelRowData[];

  const dataKunto = await Bluebird.filter(csvData, async (data: ExcelRowData) => {
    // Only consider rows that already exist in the screening log database.
    const existing = await database.getLogById(getNumbersOnly(data.nik));
    if (!existing) return false;

    // Custom NIK mode should keep the row even if screenshots already exist.
    if (normalizedTargets.length > 0) return true;

    // Force mode processes the row without tmp/public screenshot checks.
    if (force) return true;

    // Reuse tmp/public state only in the default flow.
    const tmpFilePath = getTmpScreenshotPath(data.nik);
    const publishedFilePath = getPublishedScreenshotPath(data.nik);

    // If no tmp screenshot exists yet, fetch a new one.
    if (!fs.existsSync(tmpFilePath)) return true;

    // Keep the row when tmp exists but the published asset is missing.
    return !publishedFilePath || !fs.existsSync(publishedFilePath);
  });

  let toProcess: ExcelRowData[];

  if (normalizedTargets.length > 0) {
    toProcess = dataKunto.filter((d) => normalizedTargets.includes(getNumbersOnly(d.nik)));

    const foundSet = new Set(toProcess.map((d) => getNumbersOnly(d.nik)));
    const missing = normalizedTargets.filter((n) => !foundSet.has(n));

    if (missing.length > 0) {
      const fallback = dataKunto[0];
      for (const nik of missing) {
        toProcess.push({ ...fallback, nik: String(nik) });
      }
    }
  } else if (force) {
    toProcess = dataKunto;
  } else {
    const valid = dataKunto.filter((d) => isValidNik(d.nik));

    toProcess = valid.filter((data) => {
      if (!data.nik) return false;

      const published = getPublishedScreenshotPath(data.nik);
      return !published || !fs.existsSync(published);
    });
  }

  console.log(`Total data to process: ${toProcess.length}`);

  const limited = typeof limit === 'number' ? toProcess.slice(0, limit) : toProcess;

  // Limit the work set when requested from the CLI.
  if (limited !== toProcess) {
    console.log(`Applying limit: ${limit}, processing ${limited.length} item(s).`);
  }

  for (const data of limited) {
    const tmpFilePath = getTmpScreenshotPath(data.nik);
    const publishedFilePath = getPublishedScreenshotPath(data.nik);

    // If the public asset is gone but tmp exists, rebuild the encrypted asset without fetching again.
    if (publishedFilePath && !fs.existsSync(publishedFilePath) && fs.existsSync(tmpFilePath)) {
      console.log(`Reusing tmp screenshot for NIK ${data.nik} to republish encrypted asset.`);
      publishScreenshotFromTmp(data, tmpFilePath);

      const tmpPath = path.join(process.cwd(), 'tmp', `${md5(data.nik)}-${process.pid}.json`);
      writefile(tmpPath, encryptJson(IMAGE_DATABASE, process.env.VITE_JSON_SECRET));
      fs.renameSync(tmpPath, IMAGE_DATABASE_PATH);

      continue;
    }

    // Otherwise fetch a new screenshot from the site.
    console.log(`Fetching new screenshot for NIK ${data.nik}.`);
    await findData(data, page, {
      normalizedTargets,
      openScreenshots,
      fromDate,
      toDate
    });
  }

  if (claimedEndpoint) {
    endpointManager.releaseEndpointClaim(claimedEndpoint, process.pid);
  }

  process.exit(0);
}

// stable public API layer
export const parallelSkrinCheckEndpointManager = endpointManager;
export function getParallelSkrinCheckClaimedEndpoint() {
  return claimedEndpoint;
}
