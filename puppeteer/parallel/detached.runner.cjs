'use strict';

var require$$4 = require('sbg-utility');
var puppeteer_utils = require('../../src/puppeteer_utils.cjs');
var utils = require('../../src/puppeteer/parallel/utils.cjs');

async function _main() {
    const endpoint = await utils.endpointManager.getAvailableEndpoint();
    if (!endpoint) {
        console.error('No available browser endpoints found. Make sure the launcher is running and has created an endpoint.');
        process.exit(1);
    }
    // Try to claim endpoint so other workers won't take it
    const claimed = utils.endpointManager.tryClaimEndpoint(endpoint, process.pid);
    if (!claimed) {
        console.error('Failed to claim endpoint, it may be in use by another process.');
        process.exit(1);
    }
    console.log('Connecting to browser at endpoint:', endpoint);
    const { browser } = await puppeteer_utils.getPuppeteer({ browserWSEndpoint: endpoint });
    console.log('Connected to browser WS endpoint:', browser.wsEndpoint());
    browser.once('disconnected', () => {
        // release claim when the browser disconnects
        utils.endpointManager.releaseEndpointClaim(endpoint, process.pid);
        console.log('Browser disconnected, exiting.');
        process.exit(0);
    });
    process.on('SIGINT', async () => {
        try {
            // Disconnect the Puppeteer client without closing the browser process
            // so the remote browser remains running after this script exits.
            // `disconnect()` is synchronous in the Puppeteer API, but keep await safe.
            if (typeof browser.disconnect === 'function') {
                browser.disconnect();
            }
            else {
                await browser.close();
            }
        }
        catch {
            // ignore
        }
        finally {
            // release claim on exit
            utils.endpointManager.releaseEndpointClaim(endpoint, process.pid);
            process.exit(0);
        }
    });
    // open random url to keep the browser active
    const page = await browser.pages().then((pages) => require$$4.array_random(pages) || browser.newPage());
    await page.bringToFront();
    await page.goto(require$$4.array_random([
        'https://www.google.com',
        'https://www.wikipedia.org',
        'https://www.github.com',
        'https://www.stackoverflow.com',
        'https://www.npmjs.com'
    ]));
}
_main().catch((err) => {
    console.error('Error in detached process:', err);
    process.exit(1);
});
