import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getPuppeteer, typeAndTrigger } from '../src/puppeteer_utils.js';
import { getNumbersOnly, sleep } from '../src/utils/browser.js';
import { isNikErrorVisible } from '../src/runner/skrin/isNikErrorVisible.js';
import type { Page, Browser } from 'puppeteer';
import { autoLoginAndEnterSkriningPage } from '../src/skrin_puppeteer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
  const puppeteer = await getPuppeteer();
  let page: Page = puppeteer.page;
  const browser: Browser = puppeteer.browser;

  await autoLoginAndEnterSkriningPage(page);

  page = await browser.newPage(); // Open new tab

  await page.goto('https://sumatera.sitb.id/sitb2024/skrining', { waitUntil: 'networkidle2' });
  await page.waitForSelector('#btnAdd_ta_skrining', { visible: true });
  await page.click('#btnAdd_ta_skrining');
  await page.goto('https://sumatera.sitb.id/sitb2024/Skrining/add', { waitUntil: 'networkidle2' });

  await page.waitForSelector('#nik', { visible: true });
  await sleep(3000);

  const data = {
    tanggal: '08/04/2025',
    nik: '12345'
  };

  await page.$eval('#dt_tgl_skrining', (el: Element) => el.removeAttribute('readonly'));
  await typeAndTrigger(page, '#dt_tgl_skrining', data.tanggal);
  await page.$eval('#dt_tgl_skrining', (el: Element) => el.setAttribute('readonly', 'true'));
  await typeAndTrigger(page, 'input[name="metode_id_input"]', 'Tunggal');
  await typeAndTrigger(page, 'input[name="tempat_skrining_id_input"]', 'Puskesmas');
  await typeAndTrigger(page, '#nik', getNumbersOnly(data.nik));

  console.log('Is NIK error notification visible:', await isNikErrorVisible(page));
}

main().catch(console.error);
