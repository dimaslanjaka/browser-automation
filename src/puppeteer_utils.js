import path from 'node:path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { fileURLToPath } from 'url';
import { sleep } from './utils.js';

/**
 * Get the absolute path of the current script.
 * @constant {string} __filename - The file path of the current module.
 * @constant {string} __dirname - The directory path of the current module.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Add stealth plugin and use defaults (all evasion techniques)
puppeteer.use(StealthPlugin());

/**
 * The absolute path for the user data directory.
 * @constant {string} userDataDir - The path to store browser profile data.
 */
const userDataDir = path.resolve(process.cwd(), '.cache/profile1');

/**
 * @type {import('puppeteer').Browser | null}
 */
let browser = null;

/**
 * Launches a new browser instance using `puppeteer-extra` or reuses an existing one.
 *
 * @async
 * @function getPuppeteer
 * @returns {Promise<{
 *   page: import('puppeteer').Page,
 *   browser: import('puppeteer').Browser,
 *   puppeteer: typeof import('puppeteer-extra')
 * }>}
 * Resolves with an object containing:
 * - `page`: A new Puppeteer `Page` instance.
 * - `browser`: The launched or reused Puppeteer `Browser` instance.
 * - `puppeteer`: The `puppeteer-extra` module reference.
 */
export async function getPuppeteer() {
  if (!browser || !browser.connected) {
    browser = await puppeteer.launch({
      headless: false,
      userDataDir,
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      args: [
        '--disable-features=HeavyAdIntervention', // Disable Chrome's blocking of intrusive ads
        '--disable-features=AdInterestGroupAPI', // Prevents blocking based on ad interest group
        '--disable-popup-blocking', // Disable pop-up blocking
        '--no-default-browser-check',
        '--no-first-run',
        '--ignore-certificate-errors',
        '--hide-crash-restore-bubble',
        '--autoplay-policy=no-user-gesture-required'
      ]
    });
  }

  const page = await browser.newPage();
  return { page, browser, puppeteer };
}

/**
 * Closes the Puppeteer browser instance.
 * @async
 * @function closePuppeteer
 */
export async function closePuppeteer() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Clears an input field, types a value into it, and triggers input and change events.
 *
 * @param {import('puppeteer').Page} page - The Puppeteer page instance.
 * @param {string} selector - The CSS selector for the input field.
 * @param {string} value - The value to type into the input field.
 * @returns {Promise<void>} - A promise that resolves after typing and triggering events.
 */
export async function typeAndTrigger(page, selector, value) {
  await page.focus(selector);

  // Clear the input field
  await page.evaluate((sel) => {
    const input = document.querySelector(sel);
    if (input) {
      input.value = '';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, selector);

  // Type the new value
  await page.type(selector, value, { delay: 100 });

  // Trigger input and change events
  await page.evaluate((sel) => {
    const input = document.querySelector(sel);
    if (input) {
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, selector);
  await page.keyboard.press('Tab');
  await sleep(300);
}

/**
 * Check if the element exists
 * @param {import('puppeteer').Page} page - The Puppeteer page instance.
 * @param {string} selector
 * @returns {Promise<boolean>} - Returns true if the element exists, otherwise false.
 */
export async function isElementExist(page, selector) {
  return (await page.$(selector)) !== null;
}

/**
 * @param {import('puppeteer').Page} page - The Puppeteer page instance.
 * @param {string} selector
 * @returns {Promise<boolean>}
 */
export async function isElementVisible(page, selector) {
  return await page.evaluate((sel) => {
    const elem = document.querySelector(sel);
    if (!elem) return false;

    const style = window.getComputedStyle(elem);
    return (
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      elem.offsetWidth > 0 &&
      elem.offsetHeight > 0 &&
      style.opacity !== '0'
    );
  }, selector);
}
