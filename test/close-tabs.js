import { getPuppeteer } from '../src/puppeteer_utils.js';
import { sleep } from '../src/utils-browser.js';

async function main() {
  const { browser } = await getPuppeteer();
  // Open multiple tabs
  const tabs = await Promise.all([browser.newPage(), browser.newPage(), browser.newPage()]);

  await sleep(1000); // Simulate some activity

  // Close tabs one by one, slowly
  for (const tab of tabs) {
    await sleep(3000); // Wait before closing each tab
    await tab.close();
  }

  await sleep(1000); // Simulate some activity

  await browser.close();
}

main().catch(console.error);
