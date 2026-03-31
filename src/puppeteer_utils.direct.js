import { delay } from 'sbg-utility';
import { getPuppeteer, pageScreenshoot } from './puppeteer_utils.js';
import path from 'upath';

async function _puppeterWithFingerpint() {
  const { browser, page } = await getPuppeteer({ stealth: { mode: 'fingerprint', fingerprintStrategy: 'fetch' } });

  await page.goto('https://bot.sannysoft.com/', {
    waitUntil: 'networkidle2'
  });

  await delay(5000);

  await pageScreenshoot(page, {
    path: path.join(process.cwd(), 'tmp/puppeteer/screenshoots/bot-sannysoft.png'),
    fullPage: true
  });

  await page.goto('https://www.scrapingcourse.com/antibot-challenge', {
    waitUntil: 'networkidle2'
  });

  await delay(5000);

  await pageScreenshoot(page, {
    path: path.join(process.cwd(), 'tmp/puppeteer/screenshoots/antibot-challenge.png'),
    fullPage: true
  });

  await browser.close();
}

_puppeterWithFingerpint();
