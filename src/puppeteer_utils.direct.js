import { delay } from 'sbg-utility';
import { getPuppeteer, pageScreenshoot } from './puppeteer_utils.js';
import path from 'upath';
import { fetchAndSaveFingerprintToCache } from './puppeteer/fingerprint_utils.js';
import { noop } from './utils-browser.js';

async function _puppeterWithFingerpint() {
  // fetch in background without awaiting, so it can populate cache for the main puppeteer flow
  fetchAndSaveFingerprintToCache({
    tags: ['Microsoft Windows', 'Chrome'],
    enablePrecomputedFingerprints: Math.random() < 0.5
  }).catch(noop);

  let browser;
  try {
    const launched = await getPuppeteer({
      stealth: {
        mode: 'fingerprint',
        fingerprintStrategy: 'random-cached',
        screenSize: { maxHeight: 800, maxWidth: 1366 }
      }
    });
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

    // wait until page title changes includes string "Antibot Challenge"
    await page.waitForFunction(() => document.title.includes('Antibot Challenge'), { timeout: 5 * 60 * 1000 });

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
