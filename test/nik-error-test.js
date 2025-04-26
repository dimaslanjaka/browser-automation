import { fileURLToPath } from 'node:url';
import { getPuppeteer, typeAndTrigger } from '../src/puppeteer_utils.js';
import path from 'node:path';
import dotenv from 'dotenv';
import { getNumbersOnly, sleep } from '../src/utils.js';
import { isNikErrorVisible } from '../src/skrin_utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(process.cwd(), '.env') });

async function main() {
  const puppeteer = await getPuppeteer();
  let page = puppeteer.page;
  const browser = puppeteer.browser;

  await page.goto('https://sumatera.sitb.id/sitb2024/app', { waitUntil: 'networkidle2' });
  await page.type('input[name="username"]', process.env.skrin_username);
  await page.type('input[name="password"]', process.env.skrin_password);
  await Promise.all([page.click('button[type="submit"]'), page.waitForNavigation({ waitUntil: 'networkidle2' })]);
  console.log('Login successful');

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

  await page.$eval('#dt_tgl_skrining', (el) => el.removeAttribute('readonly'));
  await typeAndTrigger(page, '#dt_tgl_skrining', data.tanggal);
  await page.$eval('#dt_tgl_skrining', (el) => el.setAttribute('readonly', 'true'));
  await typeAndTrigger(page, 'input[name="metode_id_input"]', 'Tunggal');
  await typeAndTrigger(page, 'input[name="tempat_skrining_id_input"]', 'Puskesmas');
  await typeAndTrigger(page, '#nik', getNumbersOnly(data.nik));

  console.log('Is NIK error notification visible:', await isNikErrorVisible(page));
}

main();
