'use strict';

var fs = require('fs');
var path = require('path');
require('playwright-extra');
var puppeteer = require('puppeteer-extra');
var StealthPlugin = require('puppeteer-extra-plugin-stealth');
var require$$4 = require('sbg-utility');
var url = require('url');
var Cookies = require('./puppeteer/Cookies.cjs');
var fingerprint_utils = require('./puppeteer/fingerprint_utils.cjs');
var getFormValuesFromFrame = require('./puppeteer/getFormValuesFromFrame.cjs');
var goWithRetry = require('./puppeteer/goWithRetry.cjs');
var profileManager = require('./puppeteer/profile-manager.cjs');
var browser = require('./utils/browser.cjs');

var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
/**
 * Get the absolute path of the current script.
 * @constant {string} __filename - The file path of the current module.
 * @constant {string} __dirname - The directory path of the current module.
 */
const __filename$1 = url.fileURLToPath((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('src/puppeteer_utils.cjs', document.baseURI).href)));
path.dirname(__filename$1);
/**
 * The absolute path for the user data directory.
 * @constant {string} userDataDir - The path to store browser profile data.
 */
const userDataDir = path.join(profileManager.GLOBAL_PROFILES_DIR, 'profile1');
/**
 * @type {import('puppeteer').Browser | null}
 */
let puppeteer_browser = null;
/**
 * Checks whether a Chromium user data directory appears to be in use.
 *
 * @param {string} targetUserDataDir - User data directory path to check.
 * @returns {boolean}
 */
/**
 * Returns the first available fallback profile directory path.
 *
 * @param {number} [startIndex=1] - First profile index to probe.
 * @param {string[]} [excludedDirs=[]] - Directories to skip when selecting fallback profile.
 * @returns {string}
 */
// `getFallbackProfileDir` is re-exported from `src/puppeteer/getFallbackProfileDir.js`
// Functions moved to ./puppeteer/profile-manager.js
/**
 * Launches or reuses a Puppeteer browser instance using `puppeteer-extra` with optional stealth plugin.
 *
 * @async
 * @function getPuppeteer
 * @param {import('./puppeteer_utils-d.d.ts').getPuppeteerOptions} [options] - Configuration options for launching Puppeteer.
 * @returns {Promise<import('./puppeteer_utils-d.d.ts').GetPuppeteerSingleReturn>} Resolves with `page`, `browser`, and `puppeteer`.
 *
 * @example
 * const { page, browser } = await getPuppeteer({ headless: true });
 * await page.goto('https://example.com');
 * // ...
 * await browser.close();
 *
 * @example
 * // Use random cached fingerprint or fetch new one if cache is empty
 * const { page, browser } = await getPuppeteer({
 *   stealth: {
 *     mode: 'fingerprint',
 *     fingerprintStrategy: 'random-or-fetch'
 *   }
 * });
 */
async function getPuppeteer(options = {}) {
    /** @type {import('./puppeteer_utils-d.d.ts').getPuppeteerOptions} */
    const defaultOptions = {
        headless: false,
        userDataDir: userDataDir,
        executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        args: [
            '--start-maximized',
            '--disable-features=HeavyAdIntervention',
            '--disable-features=AdInterestGroupAPI',
            '--disable-popup-blocking',
            '--no-default-browser-check',
            '--no-first-run',
            '--ignore-certificate-errors',
            '--hide-crash-restore-bubble',
            '--autoplay-policy=no-user-gesture-required',
            '--disable-infobars',
            '--disable-blink-features=AutomationControlled'
        ],
        // Remove Puppeteer's automation switch to avoid the "controlled by automated software" infobar
        ignoreDefaultArgs: ['--enable-automation'],
        reuse: true,
        autoSwitchProfileDir: true,
        devtools: false,
        stealth: {
            mode: 'default',
            fingerprintStrategy: 'fetch',
            fingerprintTags: ['Microsoft Windows', 'Chrome']
        }
    };
    const merged = { ...defaultOptions, ...options };
    const { autoSwitchProfileDir, stealth, ...launchOptions } = merged;
    const stealthMode = stealth?.mode ?? 'default';
    const fingerprintStrategy = stealth?.fingerprintStrategy ?? 'fetch';
    const fingerprintTags = stealth?.fingerprintTags ?? ['Microsoft Windows', 'Chrome'];
    const fingerprintScreenSize = stealth?.screenSize ?? undefined;
    /** @type {import('puppeteer')} */
    let puppeteer_module = puppeteer;
    /** @type {string | null} */
    let fingerprint = null;
    // Prepare stealth plugin based on options
    if (stealthMode === 'stealth' || stealthMode === 'default') {
        puppeteer_module.use(StealthPlugin());
    }
    else if (stealthMode === 'fingerprint') {
        const fingerprintPlugin = await import('puppeteer-with-fingerprints').then((mod) => {
            mod.plugin.setServiceKey('');
            return mod.plugin;
        });
        // Determine fingerprint strategy
        if (fingerprintStrategy === 'random-cached') {
            fingerprint = await fingerprint_utils.getRandomCachedFingerprint(fingerprintTags, fingerprintScreenSize);
            if (!fingerprint) {
                console.warn('No cached fingerprints available, fetching new one');
                const fetched = await fingerprint_utils.fetchAndSaveFingerprintToCache({
                    tags: fingerprintTags,
                    ...(fingerprintScreenSize || {})
                });
                fingerprint = fetched?.fingerprint ?? null;
            }
        }
        else if (fingerprintStrategy === 'latest-cached') {
            fingerprint = await fingerprint_utils.getLatestCachedFingerprint(fingerprintTags, fingerprintScreenSize);
            if (!fingerprint) {
                console.warn('No cached fingerprints available, fetching new one');
                const fetched = await fingerprint_utils.fetchAndSaveFingerprintToCache({
                    tags: fingerprintTags,
                    ...(fingerprintScreenSize || {})
                });
                fingerprint = fetched?.fingerprint ?? null;
            }
        }
        else if (fingerprintStrategy === 'random-or-fetch') {
            fingerprint = await fingerprint_utils.getRandomCachedFingerprint(fingerprintTags, fingerprintScreenSize);
            if (!fingerprint) {
                console.log('Cache empty, fetching new fingerprint');
                const fetched = await fingerprint_utils.fetchAndSaveFingerprintToCache({
                    tags: fingerprintTags,
                    ...(fingerprintScreenSize || {})
                });
                fingerprint = fetched?.fingerprint ?? null;
            }
        }
        else {
            const fetched = await fingerprint_utils.fetchAndSaveFingerprintToCache({ tags: fingerprintTags, ...(fingerprintScreenSize || {}) });
            fingerprint = fetched?.fingerprint ?? null;
        }
        if (require$$4.isEmpty(fingerprint)) {
            throw new Error('Failed to obtain a valid fingerprint using strategy: ' + fingerprintStrategy);
        }
        // When fingerprint was fetched via `fetchAndSaveFingerprintToCache` it is already cached.
        fingerprintPlugin.useFingerprint(fingerprint);
        puppeteer_module = fingerprintPlugin;
    }
    let actualProfileDir = merged.userDataDir;
    if (!puppeteer_browser || !puppeteer_browser.connected || !merged.reuse) {
        // If a remote browser WebSocket endpoint is provided, connect instead of launching.
        if (launchOptions.browserWSEndpoint) {
            try {
                puppeteer_browser = await puppeteer.connect({ browserWSEndpoint: launchOptions.browserWSEndpoint });
                const page = await puppeteer_browser.newPage();
                return { page, browser: puppeteer_browser, puppeteer };
            }
            catch (err) {
                console.warn('Failed to connect to provided browserWSEndpoint, falling back to launch:', err?.message || err);
                // fall through to launch path
            }
        }
        if (launchOptions.executablePath && !fs.existsSync(launchOptions.executablePath)) {
            launchOptions.executablePath = undefined; // Use Puppeteer's default Chromium
        }
        let usedProfileDir = merged.userDataDir;
        puppeteer_browser = await profileManager.launchWithProfileFallback({
            launchFn: async (currentLaunchOptions) => {
                usedProfileDir = currentLaunchOptions.userDataDir;
                if (stealthMode === 'fingerprint') {
                    const clonedArgs = [...currentLaunchOptions.args];
                    // remove --user-data-dir from args to avoid conflicts with fingerprint profile management
                    // remove --start-maximized from args for fingerprint mode
                    const filteredArgs = clonedArgs.filter((arg) => !arg.startsWith('--user-data-dir=') && arg !== '--start-maximized');
                    const args = [
                        ...filteredArgs,
                        '--disable-features=HeavyAdIntervention', // Disable Chrome's blocking of intrusive ads
                        '--disable-features=AdInterestGroupAPI', // Prevents blocking based on ad interest group
                        '--disable-popup-blocking', // Disable pop-up blocking
                        '--no-default-browser-check',
                        '--no-first-run',
                        '--ignore-certificate-errors',
                        '--hide-crash-restore-bubble',
                        '--autoplay-policy=no-user-gesture-required',
                        // Use a subdirectory for fingerprint profile to avoid conflicts
                        '--user-data-dir=' + path.join(currentLaunchOptions.userDataDir, 'browser-with-fingerprints')
                    ];
                    const fingerprintObj = JSON.parse(fingerprint);
                    if (fingerprintObj.ua)
                        args.push('--user-agent=' + fingerprintObj.ua);
                    if (fingerprintObj.lang)
                        args.push('--lang=' + fingerprintObj.lang);
                    return await puppeteer_module.launch({
                        args: require$$4.array_unique(args),
                        headless: currentLaunchOptions.headless,
                        devtools: currentLaunchOptions.devtools
                    });
                }
                return await puppeteer.launch(currentLaunchOptions);
            },
            launchOptions,
            autoSwitchProfileDir,
            launcherName: 'Puppeteer'
        });
        actualProfileDir = usedProfileDir;
    }
    const page = await puppeteer_browser.newPage();
    const cookie = new Cookies.PuppeteerCookies(actualProfileDir);
    // goto can be called as (url, options) or (page, url, options)
    const goto = (pageOrUrl, url, options) => {
        if (typeof pageOrUrl === 'string') {
            // (url, options)
            return goWithRetry.default(page, pageOrUrl, { ...url, cookie });
        }
        else {
            // (page, url, options)
            return goWithRetry.default(pageOrUrl, url, { ...options, cookie });
        }
    };
    return {
        page,
        browser: puppeteer_browser,
        puppeteer: puppeteer_module,
        profileDir: actualProfileDir,
        cookie,
        goto,
        navigate: goto
    };
}
/**
 * Clears an input field, types a value into it, and triggers input and change events.
 *
 * @param {import('puppeteer').Page} page - The Puppeteer page instance.
 * @param {string} selector - The CSS selector for the input field.
 * @param {string} value - The value to type into the input field.
 * @returns {Promise<void>} - A promise that resolves after typing and triggering events.
 */
async function typeAndTrigger(page, selector, value) {
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
    await browser.sleep(300);
}
/**
 * Check if the element exists and optionally if it is visible
 * @param {import('puppeteer').Page} page - The Puppeteer page instance.
 * @param {string} selector
 * @param {Object} [options] - Options object
 * @param {boolean} [options.visible=true] - Whether to check if the element is visible
 * @returns {Promise<boolean>} - Returns true if the element exists (and is visible if visible=true), otherwise false.
 */
async function isElementExist(page, selector, options = {}) {
    const { visible = true } = options;
    const element = await page.$(selector);
    if (!element)
        return false;
    if (!visible)
        return true;
    // Check visibility using the same logic as isElementVisible
    return await page.evaluate((sel) => {
        const elem = document.querySelector(sel);
        if (!elem)
            return false;
        const style = window.getComputedStyle(elem);
        return (style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            elem.offsetWidth > 0 &&
            elem.offsetHeight > 0 &&
            style.opacity !== '0');
    }, selector);
}
/**
 * @param {import('puppeteer').Page} page - The Puppeteer page instance.
 * @param {string} selector
 * @returns {Promise<boolean>}
 */
async function isElementVisible(page, selector) {
    return await page.evaluate((sel) => {
        const elem = document.querySelector(sel);
        if (!elem)
            return false;
        const style = window.getComputedStyle(elem);
        return (style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            elem.offsetWidth > 0 &&
            elem.offsetHeight > 0 &&
            style.opacity !== '0');
    }, selector);
}
/**
 * Extracts attribute values and common properties from input and textarea elements.
 *
 * NOTE: This function is executed inside the browser context (for example via `$$eval`).
 * It returns plain JSON-serializable objects and must not rely on external variables or
 * runtime helpers.
 *
 * @param {HTMLInputElement[]|HTMLTextAreaElement[]} elements - Array of input or textarea elements from the DOM.
 * @returns {Array<{[attrName: string]: string, name: string, value: string, id: string, disabled: string, isVisible: string, label: string}>} Array of plain objects. Each object contains:
 *  - all original element attributes as string keys (e.g. `type`, `maxlength`, ...)
 *  - `name` {string} - element name or empty string
 *  - `value` {string} - current element value
 *  - `id` {string} - element id or empty string
 *  - `disabled` {string} - `'true'` or `'false'`
 *  - `isVisible` {string} - `'true'` or `'false'` based on layout visibility checks
 *  - `label` {string} - nearest `.form-item-label` text found by walking up to 6 parent levels
 *
 * Example return item:
 * ```js
 * { type: 'text', name: 'first_name', value: 'Alice', id: 'f1', disabled: 'false', isVisible: 'true', label: 'First name' }
 * ```
 */
// `extractFormValues` is implemented and exported from `src/puppeteer/getFormValuesFromFrame.js`
/**
 * Get values of all input and textarea elements within a container.
 * Works with both Page and Frame contexts.
 *
 * @param {import('puppeteer').Page|import('puppeteer').Frame} context - The Puppeteer page or frame instance.
 * @param {string} containerSelector - The CSS selector for the container.
 * @returns {Promise<ReturnType<typeof extractFormValues>>} - Returns an array of objects containing name, value, id, disabled, and all attributes of each input/textarea.
 */
async function getFormValues(context, containerSelector) {
    return await context.$$eval(`${containerSelector} input, ${containerSelector} textarea`, getFormValuesFromFrame.extractFormValues);
}
/**
 * Wait until DOM becomes stable (no changes for `quietTime` ms).
 *
 * @param {import('puppeteer').Page} page
 * @param {number} quietTime - Time window where no mutations must occur (ms).
 * @param {number} timeout - Maximum total wait time (ms).
 */
async function waitForDomStable(page, quietTime = 500, timeout = 5000) {
    if (quietTime > timeout) {
        timeout = quietTime + 5000; // extend timeout
    }
    await page.evaluate(({ quietTime, timeout }) => new Promise((resolve, reject) => {
        let timer = null;
        let finished = false;
        const observer = new MutationObserver(() => {
            if (timer)
                clearTimeout(timer);
            timer = setTimeout(done, quietTime);
        });
        function done() {
            if (finished)
                return;
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
        // Start initial quiet timer
        timer = setTimeout(done, quietTime);
        // Fail-safe timeout
        setTimeout(() => {
            if (finished)
                return;
            finished = true;
            observer.disconnect();
            reject(new Error('DOM did not stabilize within timeout'));
        }, timeout);
    }), { quietTime, timeout });
}
// re-exported above from src/puppeteer/*
/**
 * Closes tabs (pages) in the browser context while preserving a given set or count of pages.
 *
 * If `instance` is a `Page`, its browser is used to list pages. If `instance` is a `Browser`,
 * its pages are used directly.
 *
 * The `keepCount` parameter supports two modes:
 * - number (legacy): keep that many most-recently opened/active pages (the newest N pages).
 * - array or `Set` of `Page` objects: explicitly preserve exactly those pages; all other pages
 *   will be closed. If a `Page` was passed as `instance` and `keepCount` is an array/Set, that
 *   page will be included among the protected pages.
 *
 * @param {import('puppeteer').Page|import('puppeteer').Browser} instance - The Puppeteer Page or Browser instance.
 *   If a Page is provided, its browser will be used to get all pages. If a Browser is provided, its pages will be used directly.
 * @param {number|import('puppeteer').Page[]|Set<import('puppeteer').Page>} [keepCount=2] - Number of pages to keep (legacy),
 *   or an array/Set of Page objects to explicitly protect.
 * @returns {Promise<void>}
 */
async function closeOtherTabs(instance, keepCount = 2) {
    // Accept either a Page or Browser instance
    let currentPage = null;
    let browser = null;
    if (instance && typeof instance.browser === 'function') {
        currentPage = instance; // instance is a Page
        browser = instance.browser();
    }
    else if (instance && typeof instance.pages === 'function') {
        browser = instance; // instance is a Browser
    }
    else {
        throw new Error('Instance must be a Puppeteer Page or Browser');
    }
    // If keepCount is an array/Set, preserve those pages (and currentPage if present)
    if (Array.isArray(keepCount) || keepCount instanceof Set) {
        const protectedPages = new Set();
        for (const p of keepCount) {
            if (p)
                protectedPages.add(p);
        }
        if (currentPage)
            protectedPages.add(currentPage);
        const pages = await browser.pages();
        if (pages.length <= protectedPages.size)
            return; // nothing to close
        const pagesToClose = pages.filter((page) => !protectedPages.has(page));
        for (const page of pagesToClose) {
            try {
                if (typeof page?.isClosed === 'function' && page.isClosed())
                    continue;
                await page.close();
            }
            catch (error) {
                const errorMessage = String(error?.message || error || '').toLowerCase();
                if (errorMessage.includes('no target with given id found') ||
                    errorMessage.includes('target closed') ||
                    errorMessage.includes('session closed')) {
                    continue;
                }
                throw error;
            }
        }
        return;
    }
    // Numeric keepCount: match closeExtraPages logic — repeatedly close the oldest page
    const keepNum = Math.max(0, Number(keepCount) || 2);
    // Close oldest pages until we have at most keepNum pages left
    while ((await browser.pages()).length > keepNum) {
        const pagesNow = (await browser.pages()).filter((p) => p);
        if (pagesNow.length === 0)
            break;
        try {
            const pageToClose = pagesNow[0];
            if (typeof pageToClose?.isClosed === 'function' && pageToClose.isClosed())
                continue;
            await pageToClose.close();
        }
        catch (error) {
            const errorMessage = String(error?.message || error || '').toLowerCase();
            if (errorMessage.includes('no target with given id found') ||
                errorMessage.includes('target closed') ||
                errorMessage.includes('session closed')) {
                continue;
            }
            throw error;
        }
    }
}
/**
 * Take a screenshot of the provided Puppeteer `page` or a specific element and save it to disk when
 * `options.path` is provided. Any directory portion of the path will be created automatically.
 *
 * @param {import('puppeteer').Page} page - Puppeteer Page instance.
 * @param {Object} [options] - Screenshot options.
 * @param {string} [options.path] - Filesystem path to write the screenshot. If omitted,
 *   Puppeteer's screenshot will still be created but this function resolves without
 *   returning the buffer.
 * @param {boolean} [options.fullPage=true] - Capture the full scrollable page (ignored if selector is set).
 * @param {string} [options.selector] - CSS selector for a specific element to screenshot.
 * @param {string} [options.type] - Image type to write: 'png', 'jpeg' or 'webp'.
 * @param {number} [options.quality] - Image quality (0-100) for lossy formats like 'jpeg' or 'webp'.
 * @returns {Promise<void>} Resolves when the screenshot operation completes.
 */
async function pageScreenshot(page, options = {}) {
    const { path: screenshotPath, fullPage = true, selector, type, quality } = options;
    // auto create directory if not exists
    if (screenshotPath) {
        const dir = path.dirname(screenshotPath);
        if (dir && dir !== '.') {
            await fs.promises.mkdir(dir, { recursive: true });
        }
    }
    if (selector) {
        // Screenshot a specific element
        const element = await page.$(selector);
        if (!element) {
            throw new Error(`Element not found for selector: ${selector}`);
        }
        /** @type {import('puppeteer').ScreenshotOptions} */
        const opts = { path: screenshotPath };
        if (type)
            opts.type = type;
        if (quality)
            opts.quality = quality;
        await element.screenshot(opts);
        return;
    }
    // Try to avoid CDP errors when the page or document reports 0 width/height
    const getPageDimensions = async () => {
        try {
            return await page.evaluate(() => {
                const doc = document.documentElement || {};
                const body = document.body || {};
                const width = Math.max(doc.clientWidth || 0, doc.scrollWidth || 0, body.scrollWidth || 0);
                const height = Math.max(doc.clientHeight || 0, doc.scrollHeight || 0, body.scrollHeight || 0);
                return { width, height, devicePixelRatio: window.devicePixelRatio || 1 };
            });
        }
        catch (_e) {
            return { width: 0, height: 0, devicePixelRatio: 1 };
        }
    };
    let dims = await getPageDimensions();
    // If dimensions look invalid, attempt to set a sensible temporary viewport
    if (!dims.width || !dims.height) {
        try {
            const vw = Math.max(800, dims.width || 800);
            const vh = Math.max(600, dims.height || 600);
            await page.setViewport({ width: vw, height: vh });
            dims = await getPageDimensions();
        }
        catch (_e) {
            // ignore and rely on fallback below
        }
    }
    try {
        // If fullPage requested but dimensions are still zero, avoid fullPage to prevent ProtocolError
        /** @type {import('puppeteer').ScreenshotOptions} */
        const opts = { path: screenshotPath, fullPage: fullPage && dims.width > 0 && dims.height > 0 };
        if (type)
            opts.type = type;
        if (quality)
            opts.quality = quality;
        await page.screenshot(opts);
    }
    catch (err) {
        const msg = String(err?.message || err || '').toLowerCase();
        if (msg.includes('cannot take screenshot with 0 width') || msg.includes('0 width')) {
            try {
                const vw = Math.max(800, dims.width || 800);
                const vh = Math.max(600, dims.height || 600);
                await page.setViewport({ width: vw, height: vh });
                const opts = { path: screenshotPath, fullPage: false };
                if (type)
                    opts.type = type;
                if (quality)
                    opts.quality = quality;
                await page.screenshot(opts);
            }
            catch (_e) {
                throw err;
            }
        }
        else {
            throw err;
        }
    }
}
/**
 * Maximizes the browser window.
 * @param {import('puppeteer').Page} page - Puppeteer Page instance.
 */
async function maximizeWindow(page) {
    const browser = page.browser();
    const session = await page.target().createCDPSession();
    const { windowId } = await session.send('Browser.getWindowForTarget');
    await session.send('Browser.setWindowBounds', {
        windowId,
        bounds: { windowState: 'maximized' }
    });
    const { width, height } = browser.wsEndpoint
        ? { width: 1920, height: 1080 }
        : await page.evaluate(() => ({ width: window.screen.availWidth, height: window.screen.availHeight }));
    await page.setViewport({ width, height });
}

exports.getFormValuesFromFrame = getFormValuesFromFrame.getFormValuesFromFrame;
exports.getFallbackProfileDir = profileManager.getFallbackProfileDir;
exports.closeOtherTabs = closeOtherTabs;
exports.getFormValues = getFormValues;
exports.getPuppeteer = getPuppeteer;
exports.isElementExist = isElementExist;
exports.isElementVisible = isElementVisible;
exports.maximizeWindow = maximizeWindow;
exports.pageScreenshot = pageScreenshot;
exports.typeAndTrigger = typeAndTrigger;
exports.userDataDir = userDataDir;
exports.waitForDomStable = waitForDomStable;
