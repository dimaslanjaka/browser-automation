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

/**
 * Helper function to set value in an iframe element
 * @param {import('puppeteer').Page} page - Puppeteer page object
 * @param {string} iframeSelector - CSS selector for the iframe
 * @param {string} elementSelector - CSS selector for the target element (use #id for IDs)
 * @param {string} value - Value to set
 * @param {Object} options - Options object
 * @param {boolean} options.triggerEvents - Whether to trigger change/input events
 * @param {boolean} options.handleDisabled - Whether to temporarily enable disabled elements
 */
export async function setIframeElementValue(page, iframeSelector, elementSelector, value, options = {}) {
  const { triggerEvents = true, handleDisabled = true } = options;

  await page.evaluate(
    ({ iframeSelector, elementSelector, value, triggerEvents, handleDisabled }) => {
      const iframe = document.querySelector(iframeSelector);
      if (!iframe || !iframe.contentDocument) {
        throw new Error(`Iframe not found or not accessible: ${iframeSelector}`);
      }

      const element = iframe.contentDocument.querySelector(elementSelector);

      if (!element) {
        throw new Error(`Element not found: ${elementSelector}`);
      }

      let wasDisabled = false;
      if (handleDisabled && element.disabled) {
        wasDisabled = true;
        element.disabled = false;
      }

      // Set the value
      element.value = value;

      // Trigger events if requested
      if (triggerEvents) {
        const changeEvent = new iframe.contentWindow.Event('change', { bubbles: true });
        element.dispatchEvent(changeEvent);

        const inputEvent = new iframe.contentWindow.Event('input', { bubbles: true });
        element.dispatchEvent(inputEvent);
      }

      // Restore disabled state if it was originally disabled
      if (wasDisabled) {
        element.disabled = true;
      }

      return true;
    },
    { iframeSelector, elementSelector, value, triggerEvents, handleDisabled }
  );
}

/**
 * Clears an input field inside an iframe, types a value into it, and triggers input and change events.
 * This is the iframe-compatible version of typeAndTrigger.
 *
 * @param {import('puppeteer').Page} page - The Puppeteer page instance.
 * @param {string} iframeSelector - CSS selector for the iframe.
 * @param {string} elementSelector - CSS selector for the input field inside the iframe (use #id for IDs, .class for classes, etc.).
 * @param {string} value - The value to type into the input field.
 * @param {Object} options - Options object
 * @param {number} options.delay - Typing delay in milliseconds
 * @param {boolean} options.clearFirst - Whether to clear the field before typing
 * @returns {Promise<void>} - A promise that resolves after typing and triggering events.
 */
export async function typeAndTriggerIframe(page, iframeSelector, elementSelector, value, options = {}) {
  const { delay = 100, clearFirst = true } = options;

  await page.evaluate(
    ({ iframeSelector, elementSelector, value, delay, clearFirst }) => {
      const iframe = document.querySelector(iframeSelector);
      if (!iframe || !iframe.contentDocument) {
        throw new Error(`Iframe not found or not accessible: ${iframeSelector}`);
      }

      const element = iframe.contentDocument.querySelector(elementSelector);

      if (!element) {
        throw new Error(`Element not found: ${elementSelector}`);
      }

      // Focus the element
      element.focus();

      // Clear the field if requested
      if (clearFirst) {
        element.value = '';
        element.dispatchEvent(new iframe.contentWindow.Event('input', { bubbles: true }));
      }

      // Type the value character by character with delay
      let currentValue = element.value;
      const typeChar = (char, index) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            currentValue += char;
            element.value = currentValue;

            // Trigger input event for each character
            element.dispatchEvent(new iframe.contentWindow.Event('input', { bubbles: true }));
            resolve();
          }, index * delay);
        });
      };

      // Type all characters
      const typePromises = Array.from(value).map((char, index) => typeChar(char, index));

      return Promise.all(typePromises).then(() => {
        // After typing is complete, trigger change event
        element.dispatchEvent(new iframe.contentWindow.Event('change', { bubbles: true }));

        // Simulate tab key press by blurring the element
        element.blur();

        return true;
      });
    },
    { iframeSelector, elementSelector, value, delay, clearFirst }
  );

  // Add a small delay after typing completion
  await sleep(300);
}

/**
 * Types a value into an input field inside an iframe using Puppeteer's Frame API.
 *
 * @param {import('puppeteer').Page} page - The Puppeteer page instance.
 * @param {string} iframeSelector - CSS selector for the iframe.
 * @param {string} elementSelector - CSS selector for the input field inside the iframe.
 * @param {string} value - The value to type into the input field.
 * @param {Object} [options] - Options object.
 * @param {number} [options.delay=100] - Typing delay in milliseconds.
 * @param {boolean} [options.clearFirst=false] - Whether to clear the field before typing.
 * @returns {Promise<void>} - A promise that resolves after typing is complete.
 */
export async function typeToIframe(page, iframeSelector, elementSelector, value, options = {}) {
  const { delay = 100, clearFirst = false } = options;
  const iframeElement = await page.$(iframeSelector);
  const iframe = await iframeElement.contentFrame();
  await iframe.focus(elementSelector);
  if (clearFirst) {
    // Clear the input field inside the iframe
    await iframe.evaluate((selector) => {
      const el = document.querySelector(selector);
      if (el) {
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, elementSelector);
    await iframe.type(elementSelector, '', { delay });
  }
  await iframe.type(elementSelector, value, { delay });
}

/**
 * Check if an element exists and is visible inside an iframe
 * @param {import('puppeteer').Page} page - The Puppeteer page instance.
 * @param {string} iframeSelector - CSS selector for the iframe
 * @param {string} elementSelector - CSS selector for the target element inside the iframe (use #id for IDs)
 * @param {Object} options - Options object
 * @param {boolean} options.checkVisibility - Whether to check if element is visible (default: true)
 * @returns {Promise<boolean>} - Returns true if the element exists and is visible inside the iframe
 */
export async function isIframeElementVisible(page, iframeSelector, elementSelector, options = {}) {
  const { checkVisibility = true } = options;

  try {
    return await page.evaluate(
      ({ iframeSelector, elementSelector, checkVisibility }) => {
        const iframe = document.querySelector(iframeSelector);
        if (!iframe || !iframe.contentDocument) {
          return false;
        }

        const element = iframe.contentDocument.querySelector(elementSelector);

        if (!element) {
          return false;
        }

        // If we don't need to check visibility, just return true since element exists
        if (!checkVisibility) {
          return true;
        }

        // Check if element is visible using the iframe's window for getComputedStyle
        const style = iframe.contentWindow.getComputedStyle(element);
        const isVisible =
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          element.offsetWidth > 0 &&
          element.offsetHeight > 0 &&
          style.opacity !== '0';

        return isVisible;
      },
      { iframeSelector, elementSelector, checkVisibility }
    );
  } catch (_error) {
    // If there's an error (e.g., iframe not accessible), return false
    return false;
  }
}

/**
 * Click an element inside an iframe
 * @param {import('puppeteer').Page} page - The Puppeteer page instance.
 * @param {string} iframeSelector - CSS selector for the iframe
 * @param {string} elementSelector - CSS selector for the target element inside the iframe
 * @param {Object} options - Options object
 * @param {boolean} options.checkVisibility - Whether to check if element is visible before clicking (default: true)
 * @returns {Promise<boolean>} - Returns true if click was successful, false otherwise
 */
export async function clickIframeElement(page, iframeSelector, elementSelector, options = {}) {
  const { checkVisibility = true } = options;

  try {
    return await page.evaluate(
      ({ iframeSelector, elementSelector, checkVisibility }) => {
        const iframe = document.querySelector(iframeSelector);
        if (!iframe || !iframe.contentDocument) {
          throw new Error(`Iframe not found or not accessible: ${iframeSelector}`);
        }

        const element = iframe.contentDocument.querySelector(elementSelector);

        if (!element) {
          throw new Error(`Element not found: ${elementSelector}`);
        }

        // Check visibility if requested
        if (checkVisibility) {
          const style = iframe.contentWindow.getComputedStyle(element);
          const isVisible =
            style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            element.offsetWidth > 0 &&
            element.offsetHeight > 0 &&
            style.opacity !== '0';

          if (!isVisible) {
            throw new Error(`Element is not visible: ${elementSelector}`);
          }
        }

        // Click the element
        element.click();
        return true;
      },
      { iframeSelector, elementSelector, checkVisibility }
    );
  } catch (error) {
    console.error(`Failed to click iframe element: ${error.message}`);
    return false;
  }
}

/**
 * Extracts attribute values and common properties from input and textarea elements.
 *
 * @param {(HTMLInputElement | HTMLTextAreaElement)[]} elements - Array of input or textarea elements.
 * @returns {Array<Record<string, string>>} Array of flattened objects containing all attributes plus name, value, id, disabled, and isVisible.
 */
function extractFormValues(elements) {
  return elements.map((el) => {
    const attrs = Array.from(el.attributes).reduce((acc, attr) => {
      acc[attr.name] = String(attr.value);
      return acc;
    }, {});

    const isVisible = !!(el.offsetParent || el.offsetWidth > 0 || el.offsetHeight > 0);

    return {
      ...attrs,
      name: el.name || '',
      value: el.value,
      id: el.id || '',
      disabled: String(el.disabled),
      isVisible: String(isVisible)
    };
  });
}

/**
 * Get values of all input and textarea elements within a container.
 * Works with both Page and Frame contexts.
 *
 * @param {import('puppeteer').Page|import('puppeteer').Frame} context - The Puppeteer page or frame instance.
 * @param {string} containerSelector - The CSS selector for the container.
 * @returns {Promise<ReturnType<typeof extractFormValues>>} - Returns an array of objects containing name, value, id, disabled, and all attributes of each input/textarea.
 */
export async function getFormValues(context, containerSelector) {
  return await context.$$eval(`${containerSelector} input, ${containerSelector} textarea`, extractFormValues);
}

/**
 * Get values of all input and textarea elements within a container inside an iframe.
 *
 * @param {import('puppeteer').Page} page - The Puppeteer page instance.
 * @param {string} iframeSelector - The CSS selector for the iframe.
 * @param {string} containerSelector - The CSS selector for the container inside the iframe.
 * @returns {Promise<ReturnType<typeof getFormValues>>}
 */
export async function getFormValuesFromFrame(page, iframeSelector, containerSelector) {
  const iframeElement = await page.$(iframeSelector);
  if (!iframeElement) throw new Error(`Iframe not found: ${iframeSelector}`);

  const frame = await iframeElement.contentFrame();
  if (!frame) throw new Error(`Failed to get frame from iframe element`);

  return await getFormValues(frame, containerSelector);
}
