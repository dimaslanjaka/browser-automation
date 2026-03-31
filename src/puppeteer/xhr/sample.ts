import path from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { delay } from 'sbg-utility';
import { getPuppeteer, pageScreenshot } from '../../puppeteer_utils.js';
import { autoLoginAndEnterSkriningPage } from '../../skrin_puppeteer.js';
import { setupXhrCapture } from './capture-xhr.js';
import { noop } from '../../utils-browser.js';

puppeteer.use(StealthPlugin());

(async () => {
  const { browser, page, puppeteer: _puppeteer } = await getPuppeteer();
  // (_puppeteer.default || (_puppeteer as any)).use(StealthPlugin());

  const baseDir = path.join(process.cwd(), 'tmp/puppeteer/xhr');
  const stopCapture = setupXhrCapture(page, { baseDir });

  await autoLoginAndEnterSkriningPage(page)
    .then(() => delay(5000))
    .catch(noop);

  await page.goto('https://bot.sannysoft.com');
  await delay(5000);

  await pageScreenshot(page, { path: path.join(process.cwd(), 'tmp/puppeteer/screenshots/bot.png'), fullPage: true });

  await stopCapture();
  await browser.close();
})();
