import { pageScreenshot } from './puppeteer_utils.js';
import puppeteerExtra from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import path from 'path';
import { delay } from 'sbg-utility';

// add the stealth plugin
puppeteerExtra.use(StealthPlugin());

(async () => {
  // set up browser environment
  const browser = await puppeteerExtra.launch({ headless: false, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();

  // navigate to a URL
  await page.goto('https://www.scrapingcourse.com/antibot-challenge', {
    waitUntil: 'networkidle0'
  });

  // wait for the challenge to resolve
  await delay(5000);

  // take page screenshot
  await pageScreenshot(page, {
    path: path.join(process.cwd(), 'tmp/puppeteer/screenshots/antibot-challenge.png'),
    fullPage: true
  });
})().catch((error) => {
  console.error('Error in puppeteer stealth example:', error);
});
