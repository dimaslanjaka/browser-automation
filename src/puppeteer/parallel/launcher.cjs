'use strict';

var path = require('path');
var puppeteerRealBrowser = require('puppeteer-real-browser');
var require$$4 = require('sbg-utility');
var url = require('url');
var puppeteer_utils = require('../../puppeteer_utils.cjs');
var goWithRetry = require('../goWithRetry.cjs');
var profileManager = require('../profile-manager.cjs');
var utils = require('./utils.cjs');

var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
const __filename$1 = url.fileURLToPath((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('src/puppeteer/parallel/launcher.cjs', document.baseURI).href)));
path.dirname(__filename$1);
async function useDefault() {
    const userDataDir = profileManager.reserveClusterUserDataDir({
        preferredUserDataDir: path.resolve(profileManager.GLOBAL_PROFILES_DIR, 'profile1'),
        reservedUserDataDirs: new Set(),
        autoSwitchProfileDir: true
    });
    console.log('User Data Dir', userDataDir);
    const { browser } = await puppeteerRealBrowser.connect({
        headless: false,
        turnstile: true,
        disableXvfb: false,
        ignoreAllFlags: false,
        customConfig: { userDataDir },
        connectOption: { protocolTimeout: 180_000 }
    });
    const goto = async (pageOrUrl, url, options) => {
        if (typeof pageOrUrl === 'string') {
            const page = await browser.newPage();
            return goWithRetry.default(page, pageOrUrl, typeof url === 'object' ? url : {});
        }
        return goWithRetry.default(pageOrUrl, typeof url === 'string' ? url : '', options);
    };
    return { browser, goto };
}
/**
 * Launches a Puppeteer browser instance in the background for parallel usage.
 *
 * Opens a maximized browser with stealth mode enabled, navigates to the
 * initial URL, and sets up target lifecycle listeners (`targetcreated`,
 * `targetdestroyed`, `targetchanged`) that refresh the shared WebSocket
 * endpoint file whenever targets change.
 *
 * After the browser is ready the function:
 * - Writes the browser's WebSocket endpoint so other processes can connect
 * - Removes stale/unavailable endpoints from the registry
 * - Creates a PID-based running-indicator file under `GLOBAL_PUPPETEER_DIR`
 *
 * The returned promise never resolves — it keeps the process alive until the
 * browser disconnects or the process receives `SIGINT`, `SIGTERM`, or `exit`,
 * at which point the endpoint is cleaned up.
 */
async function parallelLauncher() {
    const { browser } = await useDefault();
    await puppeteer_utils.closeOtherTabs(browser, 1);
    const [initialPage] = await browser.pages();
    const warmupUrls = [
        { url: 'http://www.webmanajemen.com', page: initialPage },
        { url: 'https://www.apivoid.com/tools/bot-detection-test/' },
        { url: 'https://www.scrapingcourse.com/antibot-challenge' },
        { url: 'https://bot.sannysoft.com' }
    ];
    for (const { url, page } of warmupUrls) {
        const target = page ?? (await browser.newPage());
        await goWithRetry.default(target, url, {
            waitUntil: 'networkidle2',
            timeout: 10000
        }).catch(console.log);
    }
    const logTarget = (event) => async (target) => {
        try {
            console.log(`Target ${event}:`, target.type(), target.url());
            if (event === 'created' && target.type() === 'page') {
                const pageFromTarget = await target.page();
                if (pageFromTarget)
                    console.log('New page target URL:', pageFromTarget.url());
            }
        }
        catch (err) {
            console.error(`Error handling target${event}:`, err);
        }
    };
    browser.on('targetcreated', logTarget('created'));
    browser.on('targetdestroyed', logTarget('destroyed'));
    browser.on('targetchanged', logTarget('changed'));
    const wsEndpoint = browser.wsEndpoint();
    console.log('WebSocket Endpoint:', wsEndpoint);
    utils.endpointManager.writeEndpoint(wsEndpoint);
    const endpoints = await utils.endpointManager.getAllActiveEndpoints().catch(() => []);
    for (const item of endpoints) {
        if (!item.puppeteerAvailable && item.endpoint !== wsEndpoint) {
            utils.endpointManager.removeEndpoint(item.endpoint);
            console.log('Removed unavailable endpoint:', item.endpoint);
        }
    }
    const runningIndicatorPath = path.join(profileManager.GLOBAL_PUPPETEER_DIR, 'browser-running', process.pid.toString());
    require$$4.writefile(runningIndicatorPath, 'Browser is running');
    console.log(`Browser running indicator created at: ${runningIndicatorPath}`);
    await new Promise((resolve) => {
        const release = (reason) => () => {
            utils.endpointManager.removeEndpoint(wsEndpoint);
            console.log(`${reason}, released endpoint:`, wsEndpoint);
            resolve();
        };
        browser.on('disconnected', release('Browser disconnected'));
        process.once('SIGINT', release('SIGINT'));
        process.once('SIGTERM', release('SIGTERM'));
        process.once('exit', release('Process exit'));
    });
}

exports.parallelLauncher = parallelLauncher;
exports.useDefault = useDefault;
