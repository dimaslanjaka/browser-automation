import { delay } from 'sbg-utility';
import path from 'upath';
import { getPuppeteer, pageScreenshot } from './puppeteer_utils.js';
import { autoLoginAndEnterSkriningPage } from './skrin_puppeteer.js';

async function _puppeterWithFingerpint() {
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

    await autoLoginAndEnterSkriningPage(page);
    await delay(5000);
    await pageScreenshot(page, {
      path: path.join(process.cwd(), 'tmp/puppeteer/screenshots/skrining.png'),
      fullPage: true
    });

    await page.goto('https://bot.sannysoft.com/', {
      waitUntil: 'networkidle2'
    });

    await page.waitForFunction(() => /antibot/i.test(document.title || ''), {
      timeout: 5 * 60 * 1000
    });

    await pageScreenshot(page, {
      path: path.join(process.cwd(), 'tmp/puppeteer/screenshots/bot-sannysoft.png'),
      fullPage: true
    });

    await page.goto('https://www.scrapingcourse.com/antibot-challenge', {
      waitUntil: 'networkidle2'
    });

    await page.waitForFunction(() => /antibot challenge/i.test(document.title || ''), {
      timeout: 5 * 60 * 1000
    });

    await pageScreenshot(page, {
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
