import puppeteer from 'puppeteer-extra';
import { launch } from './utils.js';
import { EndpointManager } from './EndpointManager.js';
import { bindProcessExit } from 'sbg-utility';

/**
 * Connects to a Puppeteer endpoint using EndpointManager.
 * Finds a free endpoint, claims it exclusively for the current process,
 * connects to it, performs a sample navigation, and then releases the claim.
 *
 * @returns Resolves when the connection and operations complete, or returns undefined if an endpoint could not be claimed.
 */
async function connectEndpoint() {
  const manager = new EndpointManager();
  const pid = process.pid;

  // 1️⃣ Find a free endpoint (or create a new one internally)
  let endpoint = await manager.getAvailableEndpoint();
  if (!endpoint) {
    // spawn browser then retry
    console.log('No available endpoint found. Launching a new browser instance...');
    await launch();
    endpoint = await manager.getAvailableEndpoint();
    if (!endpoint) {
      throw new Error('No available endpoint found after launch');
    } else {
      console.log('endpoint available', endpoint);
    }
  }

  // 2️⃣ Claim the endpoint exclusively for this process
  const claimed = manager.tryClaimEndpoint(endpoint, pid);
  if (!claimed) {
    throw new Error(`Failed to claim endpoint ${endpoint} - already in use by another process`);
  }

  console.log('endpoint claimed', claimed);
  // 3️⃣ Connect to the browser via the endpoint
  const browser = await puppeteer.connect({
    browserWSEndpoint: endpoint,
    protocolTimeout: 180_000
  });
  browser.once('disconnected', () => {
    // release claim when the browser disconnects
    manager.releaseEndpointClaim(endpoint, process.pid);
    console.log('Browser disconnected, exiting.');
    process.exit(0);
  });

  bindProcessExit('browser-close', async () => {
    if (endpoint) manager.releaseEndpointClaim(endpoint, process.pid);
    console.log('Browser disconnected, exiting.');
    await browser.close();
    process.exit(0);
  });

  return {
    release: () => manager.releaseEndpointClaim(endpoint, pid),
    browser
  };
}

export { connectEndpoint };
