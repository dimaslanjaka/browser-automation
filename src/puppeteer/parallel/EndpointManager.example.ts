// Example usage of EndpointManager
// This file demonstrates the basic workflow for acquiring, using, and releasing a Puppeteer endpoint.

import { Browser } from 'puppeteer';
import puppeteer from 'puppeteer';
import { EndpointManager } from './EndpointManager.js';

// Path where the temporary endpoint files are stored. Adjust if needed.
async function main(puppeteerTempPath = 'tmp/puppeteer') {
  const manager = new EndpointManager(puppeteerTempPath);
  const pid = process.pid;

  // 1️⃣ Find a free endpoint (or create a new one internally)
  const endpoint = await manager.getAvailableEndpoint();
  if (!endpoint) {
    console.error('No available endpoint found');
    return;
  }

  // 2️⃣ Claim the endpoint exclusively for this process
  const claimed = manager.tryClaimEndpoint(endpoint, pid);
  if (!claimed) {
    console.error('Failed to claim endpoint', endpoint);
    return;
  }

  let browser: Browser | null = null;

  try {
    // 3️⃣ Connect to the browser via the endpoint using standard puppeteer.connect()
    browser = await puppeteer.connect({ browserWSEndpoint: endpoint });
    const page = await browser.newPage();
    await page.goto('https://example.com');
    console.log('Page title:', await page.title());
  } finally {
    // 4️⃣ Always release the claim so other processes can reuse the endpoint
    if (browser) {
      await browser.close();
    }
    manager.releaseEndpointClaim(endpoint, pid);
  }
}

main().catch((e) => console.error(e));
