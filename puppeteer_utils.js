import './chunk-BUSYA2B4.js';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { fileURLToPath } from 'url';
import { sleep } from './utils-browser.js';
import { chromium } from 'playwright-extra';
import { Page, Browser } from 'puppeteer';

const __filename = fileURLToPath(import.meta.url);
path.dirname(__filename);
const userDataDir = path.resolve(process.cwd(), ".cache/profile1");
let puppeteer_browser = null;
let playwright_browser = null;
async function getPuppeteer(options = {}) {
  const defaultOptions = {
    headless: false,
    userDataDir,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: [
      "--disable-features=HeavyAdIntervention",
      "--disable-features=AdInterestGroupAPI",
      "--disable-popup-blocking",
      "--no-default-browser-check",
      "--no-first-run",
      "--ignore-certificate-errors",
      "--hide-crash-restore-bubble",
      "--autoplay-policy=no-user-gesture-required"
    ],
    reuse: true,
    devtools: false
  };
  const merged = { ...defaultOptions, ...options };
  puppeteer.use(StealthPlugin());
  if (!puppeteer_browser || !puppeteer_browser.connected || !merged.reuse) {
    if (merged.executablePath && !fs.existsSync(merged.executablePath)) {
      merged.executablePath = void 0;
    }
    puppeteer_browser = await puppeteer.launch(merged);
  }
  const page = await puppeteer_browser.newPage();
  return { page, browser: puppeteer_browser, puppeteer };
}
async function getPlaywright(options = {}) {
  const defaultOptions = {
    headless: false,
    userDataDir,
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    args: [
      "--disable-features=HeavyAdIntervention",
      "--disable-features=AdInterestGroupAPI",
      "--disable-popup-blocking",
      "--no-default-browser-check",
      "--no-first-run",
      "--ignore-certificate-errors",
      "--hide-crash-restore-bubble",
      "--autoplay-policy=no-user-gesture-required"
    ],
    reuse: true
  };
  const merged = { ...defaultOptions, ...options };
  chromium.use(StealthPlugin());
  if (!playwright_browser || !playwright_browser.isConnected() || !merged.reuse) {
    if (merged.executablePath && !fs.existsSync(merged.executablePath)) {
      merged.executablePath = void 0;
    }
    playwright_browser = await chromium.launch(merged);
  }
  const page = await playwright_browser.newPage();
  const context = await page.context();
  return { page, browser: playwright_browser, context, playwright: chromium };
}
async function closePuppeteer() {
  if (puppeteer_browser) {
    await puppeteer_browser.close();
    puppeteer_browser = null;
  }
}
async function typeAndTrigger(page, selector, value) {
  await page.focus(selector);
  await page.evaluate((sel) => {
    const input = document.querySelector(sel);
    if (input) {
      input.value = "";
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }, selector);
  await page.type(selector, value, { delay: 100 });
  await page.evaluate((sel) => {
    const input = document.querySelector(sel);
    if (input) {
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, selector);
  await page.keyboard.press("Tab");
  await sleep(300);
}
async function isElementExist(page, selector, options = {}) {
  const { visible = true } = options;
  const element = await page.$(selector);
  if (!element) return false;
  if (!visible) return true;
  return await page.evaluate((sel) => {
    const elem = document.querySelector(sel);
    if (!elem) return false;
    const style = window.getComputedStyle(elem);
    return style.display !== "none" && style.visibility !== "hidden" && elem.offsetWidth > 0 && elem.offsetHeight > 0 && style.opacity !== "0";
  }, selector);
}
async function isElementVisible(page, selector) {
  return await page.evaluate((sel) => {
    const elem = document.querySelector(sel);
    if (!elem) return false;
    const style = window.getComputedStyle(elem);
    return style.display !== "none" && style.visibility !== "hidden" && elem.offsetWidth > 0 && elem.offsetHeight > 0 && style.opacity !== "0";
  }, selector);
}
async function setIframeElementValue(page, iframeSelector, elementSelector, value, options = {}) {
  const { triggerEvents = true, handleDisabled = true } = options;
  await page.evaluate(
    ({ iframeSelector: iframeSelector2, elementSelector: elementSelector2, value: value2, triggerEvents: triggerEvents2, handleDisabled: handleDisabled2 }) => {
      const iframe = document.querySelector(iframeSelector2);
      if (!iframe || !iframe.contentDocument) {
        throw new Error(`Iframe not found or not accessible: ${iframeSelector2}`);
      }
      const element = iframe.contentDocument.querySelector(elementSelector2);
      if (!element) {
        throw new Error(`Element not found: ${elementSelector2}`);
      }
      let wasDisabled = false;
      if (handleDisabled2 && element.disabled) {
        wasDisabled = true;
        element.disabled = false;
      }
      element.value = value2;
      if (triggerEvents2) {
        const changeEvent = new iframe.contentWindow.Event("change", { bubbles: true });
        element.dispatchEvent(changeEvent);
        const inputEvent = new iframe.contentWindow.Event("input", { bubbles: true });
        element.dispatchEvent(inputEvent);
      }
      if (wasDisabled) {
        element.disabled = true;
      }
      return true;
    },
    { iframeSelector, elementSelector, value, triggerEvents, handleDisabled }
  );
}
async function typeAndTriggerIframe(page, iframeSelector, elementSelector, value, options = {}) {
  const { delay = 100, clearFirst = true } = options;
  await page.evaluate(
    ({ iframeSelector: iframeSelector2, elementSelector: elementSelector2, value: value2, delay: delay2, clearFirst: clearFirst2 }) => {
      const iframe = document.querySelector(iframeSelector2);
      if (!iframe || !iframe.contentDocument) {
        throw new Error(`Iframe not found or not accessible: ${iframeSelector2}`);
      }
      const element = iframe.contentDocument.querySelector(elementSelector2);
      if (!element) {
        throw new Error(`Element not found: ${elementSelector2}`);
      }
      element.focus();
      if (clearFirst2) {
        element.value = "";
        element.dispatchEvent(new iframe.contentWindow.Event("input", { bubbles: true }));
      }
      let currentValue = element.value;
      const typeChar = (char, index) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            currentValue += char;
            element.value = currentValue;
            element.dispatchEvent(new iframe.contentWindow.Event("input", { bubbles: true }));
            resolve();
          }, index * delay2);
        });
      };
      const typePromises = Array.from(value2).map((char, index) => typeChar(char, index));
      return Promise.all(typePromises).then(() => {
        const events = ["input", "change", "blur", "keyup"];
        events.forEach((eventType) => {
          const event = new iframe.contentWindow.Event(eventType, {
            bubbles: true,
            cancelable: true
          });
          element.dispatchEvent(event);
        });
        if (typeof iframe.contentWindow.$ !== "undefined" && iframe.contentWindow.$(element).length) {
          iframe.contentWindow.$(element).trigger("change").trigger("blur");
        }
        if (element.id.includes("tgl") || element.classList.contains("datepicker") || element.getAttribute("data-role") === "datepicker") {
          const specificEvents = ["datechange", "dp.change", "changeDate"];
          specificEvents.forEach((eventType) => {
            try {
              const event = new iframe.contentWindow.Event(eventType, {
                bubbles: true,
                cancelable: true
              });
              element.dispatchEvent(event);
            } catch (_e) {
            }
          });
        }
        element.blur();
        return true;
      });
    },
    { iframeSelector, elementSelector, value, delay, clearFirst }
  );
  await sleep(1e3);
}
async function typeToIframe(page, iframeSelector, elementSelector, value, options = {}) {
  const { delay = 100, clearFirst = false } = options;
  const iframeElement = await page.$(iframeSelector);
  const iframe = await iframeElement.contentFrame();
  await iframe.focus(elementSelector);
  if (clearFirst) {
    await iframe.evaluate((selector) => {
      const el = document.querySelector(selector);
      if (el) {
        el.value = "";
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }, elementSelector);
    await iframe.type(elementSelector, "", { delay });
  }
  await iframe.type(elementSelector, value, { delay });
  await iframe.evaluate((selector) => {
    const el = document.querySelector(selector);
    if (el) {
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    }
  }, elementSelector);
  await page.keyboard.press("Tab");
  await sleep(300);
}
async function isIframeElementVisible(page, iframeSelector, elementSelector, options = {}) {
  const { checkVisibility = true } = options;
  try {
    return await page.evaluate(
      ({ iframeSelector: iframeSelector2, elementSelector: elementSelector2, checkVisibility: checkVisibility2 }) => {
        const iframe = document.querySelector(iframeSelector2);
        if (!iframe || !iframe.contentDocument) {
          return false;
        }
        const element = iframe.contentDocument.querySelector(elementSelector2);
        if (!element) {
          return false;
        }
        if (!checkVisibility2) {
          return true;
        }
        const style = iframe.contentWindow.getComputedStyle(element);
        const isVisible = style.display !== "none" && style.visibility !== "hidden" && element.offsetWidth > 0 && element.offsetHeight > 0 && style.opacity !== "0";
        return isVisible;
      },
      { iframeSelector, elementSelector, checkVisibility }
    );
  } catch (_error) {
    return false;
  }
}
async function clickIframeElement(page, iframeSelector, elementSelector, options = {}) {
  const { checkVisibility = true } = options;
  try {
    return await page.evaluate(
      ({ iframeSelector: iframeSelector2, elementSelector: elementSelector2, checkVisibility: checkVisibility2 }) => {
        const iframe = document.querySelector(iframeSelector2);
        if (!iframe || !iframe.contentDocument) {
          throw new Error(`Iframe not found or not accessible: ${iframeSelector2}`);
        }
        const element = iframe.contentDocument.querySelector(elementSelector2);
        if (!element) {
          throw new Error(`Element not found: ${elementSelector2}`);
        }
        if (checkVisibility2) {
          const style = iframe.contentWindow.getComputedStyle(element);
          const isVisible = style.display !== "none" && style.visibility !== "hidden" && element.offsetWidth > 0 && element.offsetHeight > 0 && style.opacity !== "0";
          if (!isVisible) {
            throw new Error(`Element is not visible: ${elementSelector2}`);
          }
        }
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
function extractFormValues(elements) {
  return elements.map((el) => {
    const attrs = Array.from(el.attributes).reduce((acc, attr) => {
      acc[attr.name] = String(attr.value);
      return acc;
    }, {});
    const isVisible = !!(el.offsetParent || el.offsetWidth > 0 || el.offsetHeight > 0);
    let textLabel = "";
    let currentEl = el;
    for (let i = 0; i < 6 && currentEl; i++) {
      const labelEl = currentEl.querySelector(".form-item-label");
      if (labelEl) {
        textLabel = labelEl.textContent.trim();
        break;
      }
      currentEl = currentEl.parentElement;
    }
    return {
      ...attrs,
      name: el.name || "",
      value: el.value,
      id: el.id || "",
      disabled: String(el.disabled),
      isVisible: String(isVisible),
      label: textLabel
    };
  });
}
async function getFormValues(context, containerSelector) {
  return await context.$$eval(`${containerSelector} input, ${containerSelector} textarea`, extractFormValues);
}
async function getFormValuesFromFrame(page, iframeSelector, containerSelector) {
  const iframeElement = await page.$(iframeSelector);
  if (!iframeElement) throw new Error(`Iframe not found: ${iframeSelector}`);
  const frame = await iframeElement.contentFrame();
  if (!frame) throw new Error(`Failed to get frame from iframe element`);
  return await getFormValues(frame, containerSelector);
}
async function triggerInputChange(page, selector, options = {}) {
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
  if (!frame) throw new Error("Target frame could not be resolved.");
  await frame.evaluate((selector2) => {
    const el = document.querySelector(selector2);
    if (!el) throw new Error(`Element not found: ${selector2}`);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }, selector);
}
async function validateAndRetryIframeInput(page, iframeSelector, elementSelector, expectedValue, options = {}) {
  const { maxRetries = 3, retryDelay = 1e3 } = options;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const currentValue = await page.evaluate(
      ({ iframeSelector: iframeSelector2, elementSelector: elementSelector2 }) => {
        const iframe = document.querySelector(iframeSelector2);
        if (!iframe || !iframe.contentDocument) {
          return null;
        }
        const element = iframe.contentDocument.querySelector(elementSelector2);
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
      await page.evaluate(
        ({ iframeSelector: iframeSelector2, elementSelector: elementSelector2, expectedValue: expectedValue2 }) => {
          const iframe = document.querySelector(iframeSelector2);
          if (!iframe || !iframe.contentDocument) {
            return;
          }
          const element = iframe.contentDocument.querySelector(elementSelector2);
          if (!element) {
            return;
          }
          element.value = expectedValue2;
          const allEvents = [
            "input",
            "change",
            "blur",
            "focus",
            "keyup",
            "keydown",
            "keypress",
            "paste",
            "cut",
            "beforeinput",
            "afterinput"
          ];
          allEvents.forEach((eventType) => {
            try {
              const event = new iframe.contentWindow.Event(eventType, {
                bubbles: true,
                cancelable: true
              });
              element.dispatchEvent(event);
            } catch (_e) {
            }
          });
          if (typeof iframe.contentWindow.$ !== "undefined" && iframe.contentWindow.$(element).length) {
            iframe.contentWindow.$(element).trigger("change").trigger("blur").trigger("input");
          }
          if (typeof iframe.contentWindow.kendo !== "undefined") {
            const kendoWidget = iframe.contentWindow.kendo.widgetInstance(element);
            if (kendoWidget && typeof kendoWidget.trigger === "function") {
              kendoWidget.trigger("change");
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
async function waitForDomStable(page, quietTime = 500, timeout = 5e3) {
  if (quietTime > timeout) {
    timeout = quietTime + 5e3;
  }
  await page.evaluate(
    ({ quietTime: quietTime2, timeout: timeout2 }) => new Promise((resolve, reject) => {
      let timer = null;
      let finished = false;
      const observer = new MutationObserver(() => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(done, quietTime2);
      });
      function done() {
        if (finished) return;
        finished = true;
        observer.disconnect();
        resolve();
      }
      observer.observe(document, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
      });
      timer = setTimeout(done, quietTime2);
      setTimeout(() => {
        if (finished) return;
        finished = true;
        observer.disconnect();
        reject(new Error("DOM did not stabilize within timeout"));
      }, timeout2);
    }),
    { quietTime, timeout }
  );
}
async function waitForDomStableIndefinite(page) {
  await page.evaluate(
    () => new Promise((resolve) => {
      let pendingMutations = false;
      const observer = new MutationObserver(() => {
        pendingMutations = true;
      });
      observer.observe(document, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
      });
      function checkStability() {
        if (!pendingMutations) {
          observer.disconnect();
          resolve();
        } else {
          pendingMutations = false;
          requestAnimationFrame(checkStability);
        }
      }
      requestAnimationFrame(checkStability);
    })
  );
}
async function anyElementWithTextExists(page, selector, text) {
  const elementHandles = await page.$$(selector);
  for (const el of elementHandles) {
    const matchesText = await page.evaluate(
      (element, expectedText) => {
        const normalize = (str) => {
          if (!str) return "";
          return str.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, " ").replace(/\s+/g, " ").trim();
        };
        const style = window.getComputedStyle(element);
        const isVisible = style && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
        const elementText = normalize(element.textContent);
        const normalizedExpected = normalize(expectedText);
        return isVisible && elementText.includes(normalizedExpected);
      },
      el,
      text
    );
    if (matchesText) return true;
  }
  return false;
}
async function elementExists(page, selector) {
  const elementHandle = await page.$(selector);
  if (!elementHandle) return false;
  const isVisible = await page.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return style && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }, elementHandle);
  return isVisible;
}
async function elementWithTextExists(page, selector, text) {
  const elementHandle = await page.$(selector);
  if (!elementHandle) return false;
  const matchesText = await page.evaluate(
    (el, expectedText) => {
      var _a;
      const style = window.getComputedStyle(el);
      const isVisible = style && style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
      return isVisible && ((_a = el.textContent) == null ? void 0 : _a.includes(expectedText));
    },
    elementHandle,
    text
  );
  return matchesText;
}
async function elementsContainText(page, selector, text) {
  return await page.evaluate(
    (sel, str) => {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (el.innerText.includes(str)) {
          return true;
        }
      }
      return false;
    },
    selector,
    text
  );
}
async function clearCurrentPageCookies(page) {
  const client = await page.createCDPSession();
  const url = new URL(page.url());
  const { cookies } = await client.send("Network.getCookies", {
    urls: [url.origin]
  });
  for (const cookie of cookies) {
    await client.send("Network.deleteCookies", {
      name: cookie.name,
      domain: cookie.domain,
      path: cookie.path
      // important, otherwise deletion may fail
    });
  }
  const { cookies: remaining } = await client.send("Network.getCookies", {
    urls: [url.origin]
  });
  if (remaining.length > 0) {
    console.warn(`\u26A0\uFE0F Some cookies not cleared for ${url.hostname}:`, remaining);
  } else {
    console.log(`\u2705 All cookies cleared for ${url.hostname}`);
  }
  const xclient = await page.target().createCDPSession();
  await xclient.send("Network.clearBrowserCookies");
}
async function clickElementByText(page, selector, text) {
  const elements = await page.$$(selector);
  if (elements.length === 0) {
    throw new Error(`No elements found for selector: ${selector}`);
  }
  for (const el of elements) {
    const elementText = await el.evaluate((el2) => {
      let t = el2.innerText || "";
      t = t.replace(/[\u200B-\u200D\uFEFF]/g, "");
      t = t.replace(/[^\p{L}\p{N} ]/gu, "");
      t = t.replace(/\s+/g, " ").trim().toLowerCase();
      return t;
    });
    if (elementText === text.toLowerCase()) {
      await el.click();
      return true;
    }
  }
  return false;
}
async function closeFirstTab(context) {
  if (context instanceof Page) {
    const browser = context.browser();
    const pages = await browser.pages();
    if (pages.length > 1) {
      await pages[0].close();
    }
  } else if (context instanceof Browser) {
    const pages = await context.pages();
    if (pages.length > 1) {
      await pages[0].close();
    }
  }
}

export { anyElementWithTextExists, clearCurrentPageCookies, clickElementByText, clickIframeElement, closeFirstTab, closePuppeteer, elementExists, elementWithTextExists, elementsContainText, getFormValues, getFormValuesFromFrame, getPlaywright, getPuppeteer, isElementExist, isElementVisible, isIframeElementVisible, setIframeElementValue, triggerInputChange, typeAndTrigger, typeAndTriggerIframe, typeToIframe, validateAndRetryIframeInput, waitForDomStable, waitForDomStableIndefinite };
//# sourceMappingURL=puppeteer_utils.js.map
//# sourceMappingURL=puppeteer_utils.js.map