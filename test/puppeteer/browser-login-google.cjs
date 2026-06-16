const profileManager = require('../../src/puppeteer/profile-manager.js');
const puppeteer = require('puppeteer-extra');
const path = require('upath');
const { noop } = require('sbg-utility');

// Add stealth plugin and use defaults (all tricks to hide puppeteer usage)
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
// Add adblocker plugin to block all ads and trackers (saves bandwidth)
const AdblockerPlugin = require('puppeteer-extra-plugin-adblocker');
puppeteer.use(AdblockerPlugin({ blockTrackers: true }));

async function closeAllExceptLast(browser) {
  const pages = await browser.pages();

  if (pages.length <= 1) return;

  const lastPage = pages[pages.length - 1];

  await Promise.all(pages.slice(0, -1).map((page) => page.close().catch(() => {})));

  return lastPage;
}

(async function () {
  // That's it, the rest is puppeteer usage as normal
  const browser = await puppeteer.launch({
    headless: false,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Use real Chrome
    userDataDir: path.resolve(profileManager.GLOBAL_PROFILES_DIR, 'profile1'), // Stores cookies/sessions
    ignoreDefaultArgs: ['--enable-automation'], // Removes the automated control banner
    args: ['--disable-blink-features=AutomationControlled', '--start-maximized', '--disable-features=site-per-process']
  });
  await closeAllExceptLast(browser);
  const goto = async (url) => {
    const page = await browser.newPage();
    await page.goto(url).catch(noop);
  };

  goto('https://accounts.google.com/');
  goto('https://www.scrapingcourse.com/antibot-challenge');
  goto('https://bot.sannysoft.com');
})();
