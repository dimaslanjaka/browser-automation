import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { fileURLToPath } from 'url';
import { sleep } from './utils-browser.js';
import { chromium } from 'playwright-extra';

/**
 * Get the absolute path of the current script.
 * @constant {string} __filename - The file path of the current module.
 * @constant {string} __dirname - The directory path of the current module.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * The absolute path for the user data directory.
 * @constant {string} userDataDir - The path to store browser profile data.
 */
const userDataDir = path.resolve(process.cwd(), '.cache/profile1');

/**
 * @type {import('puppeteer').Browser | null}
 */
let puppeteer_browser = null;
/**
 * @type {import('playwright').Browser | null}
 */
let playwright_browser = null;

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
  // Add stealth plugin and use defaults (all evasion techniques)
  puppeteer.use(StealthPlugin());

  if (!puppeteer_browser || !puppeteer_browser.connected) {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    if (!fs.existsSync(chromePath)) {
      throw new Error(`Chrome executable not found at: ${chromePath}`);
    }
    puppeteer_browser = await puppeteer.launch({
      headless: false,
      userDataDir,
      executablePath: chromePath,
      args: [
        '--disable-features=HeavyAdIntervention',
        '--disable-features=AdInterestGroupAPI',
        '--disable-popup-blocking',
        '--no-default-browser-check',
        '--no-first-run',
        '--ignore-certificate-errors',
        '--hide-crash-restore-bubble',
        '--autoplay-policy=no-user-gesture-required'
      ]
    });
  }

  const page = await puppeteer_browser.newPage();
  return { page, browser: puppeteer_browser, puppeteer };
}

/**
 * Launches a new browser instance using Playwright or reuses an existing one.
 *
 * @async
 * @function getPlaywright
 * @returns {Promise<{
 *   page: import('playwright').Page,
 *   browser: import('playwright').Browser,
 *   context: import('playwright').BrowserContext,
 *   playwright: typeof import('playwright').chromium
 * }>} Resolves with an object containing:
 * - `page`: A new Playwright `Page` instance.
 * - `browser`: The launched or reused Playwright `Browser` instance.
 * - `context`: The Playwright `BrowserContext` instance.
 * - `playwright`: The Playwright `chromium` module reference.
 */
export async function getPlaywright() {
  // Add the plugin to playwright (any number of plugins can be added)
  chromium.use(StealthPlugin());

  if (!playwright_browser || !playwright_browser.isConnected()) {
    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    if (!fs.existsSync(chromePath)) {
      throw new Error(`Chrome executable not found at: ${chromePath}`);
    }
    playwright_browser = await chromium.launch({
      headless: false,
      userDataDir,
      executablePath: chromePath,
      args: [
        '--disable-features=HeavyAdIntervention',
        '--disable-features=AdInterestGroupAPI',
        '--disable-popup-blocking',
        '--no-default-browser-check',
        '--no-first-run',
        '--ignore-certificate-errors',
        '--hide-crash-restore-bubble',
        '--autoplay-policy=no-user-gesture-required'
      ]
    });
  }

  const page = await playwright_browser.newPage();
  const context = await page.context();
  return { page, browser: playwright_browser, context, playwright: chromium };
}

/**
 * Closes the Puppeteer browser instance.
 * @async
 * @function closePuppeteer
 */
export async function closePuppeteer() {
  if (puppeteer_browser) {
    await puppeteer_browser.close();
    puppeteer_browser = null;
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
        // More robust event triggering after typing is complete
        const events = ['input', 'change', 'blur', 'keyup'];
        events.forEach((eventType) => {
          const event = new iframe.contentWindow.Event(eventType, {
            bubbles: true,
            cancelable: true
          });
          element.dispatchEvent(event);
        });

        // Also trigger jQuery events if jQuery is available in the iframe
        if (typeof iframe.contentWindow.$ !== 'undefined' && iframe.contentWindow.$(element).length) {
          iframe.contentWindow.$(element).trigger('change').trigger('blur');
        }

        // For datepicker or special inputs, also trigger specific events
        if (
          element.id.includes('tgl') ||
          element.classList.contains('datepicker') ||
          element.getAttribute('data-role') === 'datepicker'
        ) {
          const specificEvents = ['datechange', 'dp.change', 'changeDate'];
          specificEvents.forEach((eventType) => {
            try {
              const event = new iframe.contentWindow.Event(eventType, {
                bubbles: true,
                cancelable: true
              });
              element.dispatchEvent(event);
            } catch (_e) {
              // Ignore if event type doesn't exist
            }
          });
        }

        // Simulate tab key press by blurring the element
        element.blur();

        return true;
      });
    },
    { iframeSelector, elementSelector, value, delay, clearFirst }
  );

  // Add a small delay after typing completion
  await sleep(1000);
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
  await iframe.evaluate((selector) => {
    const el = document.querySelector(selector);
    if (el) {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, elementSelector);
  await page.keyboard.press('Tab'); // Simulate tab key press to blur
  await sleep(300); // Wait for any potential UI updates after typing
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
    let textLabel = '';
    let currentEl = el; // Start from the target element

    for (let i = 0; i < 6 && currentEl; i++) {
      const labelEl = currentEl.querySelector('.form-item-label');
      if (labelEl) {
        textLabel = labelEl.textContent.trim();
        break;
      }
      currentEl = currentEl.parentElement; // Move one level up
    }

    return {
      ...attrs,
      name: el.name || '',
      value: el.value,
      id: el.id || '',
      disabled: String(el.disabled),
      isVisible: String(isVisible),
      label: textLabel
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

/**
 * Triggers 'input' and 'change' events on an input or textarea element,
 * optionally within an iframe. Does NOT change the element’s value.
 *
 * @param {import('puppeteer').Page} page - Puppeteer Page object
 * @param {string} selector - CSS selector for the input or textarea
 * @param {Object} [options]
 * @param {string} [options.frameSelector] - Optional iframe CSS selector
 * @param {string} [options.frameName] - Optional iframe name
 */
export async function triggerInputChange(page, selector, options = {}) {
  const { frameSelector, frameName } = options;

  let frame = page.mainFrame();

  if (frameSelector) {
    const iframeHandle = await page.$(frameSelector);
    if (!iframeHandle) throw new Error(`Iframe not found with selector: ${frameSelector}`);
    frame = await iframeHandle.contentFrame();
  } else if (frameName) {
    frame = page.frames().find((f) => f.name() === frameName);
    if (!frame) throw new Error(`Iframe not found with name: ${frameName}`);
  }

  if (!frame) throw new Error('Target frame could not be resolved.');

  await frame.evaluate((selector) => {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Element not found: ${selector}`);

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, selector);
}

/**
 * Validates that a value was properly set in an iframe element and optionally retries with enhanced event triggering
 * @param {Object} page - Puppeteer page object
 * @param {string} iframeSelector - CSS selector for the iframe
 * @param {string} elementSelector - CSS selector for the element within the iframe
 * @param {string} expectedValue - Expected value that should be in the element
 * @param {Object} options - Options for retry behavior
 * @returns {Promise<boolean>} - True if validation passed, false otherwise
 */
export async function validateAndRetryIframeInput(page, iframeSelector, elementSelector, expectedValue, options = {}) {
  const { maxRetries = 3, retryDelay = 1000 } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check if the value was properly set
    const currentValue = await page.evaluate(
      ({ iframeSelector, elementSelector }) => {
        const iframe = document.querySelector(iframeSelector);
        if (!iframe || !iframe.contentDocument) {
          return null;
        }

        const element = iframe.contentDocument.querySelector(elementSelector);
        return element ? element.value : null;
      },
      { iframeSelector, elementSelector }
    );

    if (currentValue === expectedValue) {
      return true;
    }

    if (attempt < maxRetries) {
      console.log(
        `Validation failed for ${elementSelector}, attempt ${attempt + 1}/${maxRetries + 1}. Expected: "${expectedValue}", Got: "${currentValue}". Retrying...`
      );

      // Enhanced retry with more aggressive event triggering
      await page.evaluate(
        ({ iframeSelector, elementSelector, expectedValue }) => {
          const iframe = document.querySelector(iframeSelector);
          if (!iframe || !iframe.contentDocument) {
            return;
          }

          const element = iframe.contentDocument.querySelector(elementSelector);
          if (!element) {
            return;
          }

          // Force set the value
          element.value = expectedValue;

          // Trigger all possible events that might be needed
          const allEvents = [
            'input',
            'change',
            'blur',
            'focus',
            'keyup',
            'keydown',
            'keypress',
            'paste',
            'cut',
            'beforeinput',
            'afterinput'
          ];

          allEvents.forEach((eventType) => {
            try {
              const event = new iframe.contentWindow.Event(eventType, {
                bubbles: true,
                cancelable: true
              });
              element.dispatchEvent(event);
            } catch (_e) {
              // Ignore if event type doesn't exist
            }
          });

          // Trigger jQuery events if available
          if (typeof iframe.contentWindow.$ !== 'undefined' && iframe.contentWindow.$(element).length) {
            iframe.contentWindow.$(element).trigger('change').trigger('blur').trigger('input');
          }

          // For Kendo UI components (common in enterprise apps)
          if (typeof iframe.contentWindow.kendo !== 'undefined') {
            const kendoWidget = iframe.contentWindow.kendo.widgetInstance(element);
            if (kendoWidget && typeof kendoWidget.trigger === 'function') {
              kendoWidget.trigger('change');
            }
          }
        },
        { iframeSelector, elementSelector, expectedValue }
      );

      await sleep(retryDelay);
    }
  }

  console.warn(`Failed to validate input after ${maxRetries + 1} attempts for ${elementSelector}`);
  return false;
}
