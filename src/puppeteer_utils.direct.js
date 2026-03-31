import { delay } from 'sbg-utility';
import { getPuppeteer, pageScreenshoot } from './puppeteer_utils.js';
import path from 'upath';

async function _puppeterWithFingerpint() {
  let browser;
  try {
    const launched = await getPuppeteer({ stealth: { mode: 'fingerprint', fingerprintStrategy: 'fetch' } });
    browser = launched.browser;
    const { page } = launched;

    await page.goto('https://bot.sannysoft.com/', {
      waitUntil: 'networkidle2'
    });

    await delay(5000);

    await pageScreenshoot(page, {
      path: path.join(process.cwd(), 'tmp/puppeteer/screenshots/bot-sannysoft.png'),
      fullPage: true
    });

    await page.goto('https://www.scrapingcourse.com/antibot-challenge', {
      waitUntil: 'networkidle2'
    });

    await delay(5000);

    await pageScreenshoot(page, {
      path: path.join(process.cwd(), 'tmp/puppeteer/screenshots/antibot-challenge.png'),
      fullPage: true
    });
  } finally {
    try {
      if (browser?.connected) {
        await browser.close();
      }
    } catch (error) {
      const message = String(error?.message || error || '');
      if (!message.includes('ECONNRESET') && !message.toLowerCase().includes('target closed')) {
        console.warn(`Browser close failed: ${message}`);
      } else {
        console.warn(`Ignored browser close error: ${message}`);
      }
    }
  }
}

_puppeterWithFingerpint().catch((error) => {
  console.error('Fingerprint demo failed:', error?.stack || error);
  process.exitCode = 1;
});
