import { connect } from 'puppeteer-real-browser';
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
  const endpoint = await manager.getAvailableEndpoint();
  if (!endpoint) {
    throw new Error('No available endpoint found');
  }

  // 2️⃣ Claim the endpoint exclusively for this process
  const claimed = manager.tryClaimEndpoint(endpoint, pid);
  if (!claimed) {
    throw new Error(`Failed to claim endpoint ${endpoint}`);
  }

  // 3️⃣ Connect to the browser via the endpoint using standard puppeteer.connect()
  const { browser } = await connect({ connectOption: { browserWSEndpoint: endpoint } });

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
