import { array_random } from 'sbg-utility';
import { getPuppeteer } from '../../puppeteer_utils.js';
import { endpointManager } from './utils.js';

async function _main() {
  const endpoint = endpointManager.getAvailableEndpoint();
  if (!endpoint) {
    console.error(
      'No available browser endpoints found. Make sure the launcher is running and has created an endpoint.'
    );
    process.exit(1);
  }

  // Try to claim endpoint so other workers won't take it
  const claimed = endpointManager.tryClaimEndpoint(endpoint, process.pid);
  if (!claimed) {
    console.error('Failed to claim endpoint, it may be in use by another process.');
    process.exit(1);
  }

  console.log('Connecting to browser at endpoint:', endpoint);
  const { browser } = await getPuppeteer({ browserWSEndpoint: endpoint });
  console.log('Connected to browser WS endpoint:', browser.wsEndpoint());

  browser.once('disconnected', () => {
    // release claim when the browser disconnects
    endpointManager.releaseEndpointClaim(endpoint, process.pid);
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
      } else {
        await browser.close();
      }
    } catch {
      // ignore
    } finally {
      // release claim on exit
      endpointManager.releaseEndpointClaim(endpoint, process.pid);
      process.exit(0);
    }
  });

  // open random url to keep the browser active
  const page = await browser.pages().then((pages) => array_random(pages) || browser.newPage());
  await page.bringToFront();
  await page.goto(
    array_random([
      'https://www.google.com',
      'https://www.wikipedia.org',
      'https://www.github.com',
      'https://www.stackoverflow.com',
      'https://www.npmjs.com'
    ])
  );
}

_main().catch((err) => {
  console.error('Error in detached process:', err);
  process.exit(1);
});
