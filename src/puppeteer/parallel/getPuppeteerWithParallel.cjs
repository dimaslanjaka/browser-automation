'use strict';

var require$$4 = require('sbg-utility');
var puppeteer_utils = require('../../puppeteer_utils.cjs');
var browser = require('../../utils/browser.cjs');
var puppeteer_parallel_EndpointManager = require('../../../puppeteer/parallel/EndpointManager.cjs');

let registered = false;
/**
 * Acquire a Puppeteer `page` and `browser` connected to an available shared browser endpoint.
 *
 * This function will try to claim an available endpoint via the local `EndpointManager`,
 * connect using `getPuppeteer`, and return the connected `page` and `browser` together with
 * the managing `endpointManager`, the claimed `endpoint` string, and a `release` helper to
 * free the claim (and optionally close the browser) when finished.
 *
 * @async
 * @param options Optional options forwarded to `getPuppeteer` (e.g. for puppeteer.connect).
 * @returns An object: `{ page, browser, endpoint, endpointManager, release }`.
 */
async function getPuppeteerWithParallel(options = {}) {
    if (!registered) {
        require$$4.scheduler.register();
        registered = true;
    }
    const endpointManager = new puppeteer_parallel_EndpointManager.EndpointManager();
    let claimedEndpoint;
    let browser$1;
    const tried = new Set();
    while (true) {
        const endpoint = await endpointManager.getAvailableEndpoint();
        if (!endpoint) {
            console.error('No browser endpoint available to connect.');
            process.exit(1);
        }
        if (tried.has(endpoint)) {
            // All known endpoints exhausted
            console.error('No free browser endpoint found after trying all endpoints.');
            process.exit(1);
        }
        // Try to claim it
        const claimed = endpointManager.tryClaimEndpoint(endpoint, process.pid);
        if (!claimed) {
            tried.add(endpoint);
            continue;
        }
        try {
            // connect using existing helper which will use puppeteer.connect when browserWSEndpoint is provided
            const res = await puppeteer_utils.getPuppeteer({ ...options, autoSwitchProfileDir: true, browserWSEndpoint: endpoint });
            browser$1 = res.browser;
            res.page.goto('http://www.webmanajemen.com').catch(browser.noop);
            claimedEndpoint = endpoint;
            break;
        }
        catch (err) {
            // Release claim and remove dead endpoint if connection refused
            endpointManager.releaseEndpointClaim(endpoint, process.pid);
            tried.add(endpoint);
            const errObj = err?.error || err;
            if (errObj?.code === 'ECONNREFUSED') {
                endpointManager.removeEndpoint(endpoint);
            }
            // try next endpoint
            continue;
        }
    }
    require$$4.bindProcessExit('browser-close', async () => {
        if (claimedEndpoint)
            endpointManager.releaseEndpointClaim(claimedEndpoint, process.pid);
        console.log('Browser disconnected, exiting.');
        await browser$1.close();
        process.exit(0);
    });
    // open a new page and bring it to front (sometimes the connected browser doesn't have a page or the page is not focused)
    const page = await browser$1.newPage();
    page.goto('http://www.webmanajemen.com').catch(browser.noop);
    await page.bringToFront();
    // close extra tabs if more than 2 are open (sometimes puppeteer.connect opens an extra blank tab)
    await puppeteer_utils.closeOtherTabs(browser$1, 2);
    /**
     * Release the claimed endpoint and optionally close the browser.
     *
     * @param [closeBrowser=false] - If true, close the connected browser instance.
     * @returns Resolves when the browser has been closed (if requested), or immediately otherwise.
     */
    const release = (closeBrowser = false) => {
        if (claimedEndpoint)
            endpointManager.releaseEndpointClaim(claimedEndpoint, process.pid);
        console.log('Releasing claimed endpoint and closing browser.');
        return closeBrowser ? browser$1.close() : Promise.resolve();
    };
    return { page, browser: browser$1, endpoint: claimedEndpoint, endpointManager, release };
}

exports.getPuppeteerWithParallel = getPuppeteerWithParallel;
