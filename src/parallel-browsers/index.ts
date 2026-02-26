import { Page } from 'puppeteer';
import { connect } from './utils.js';
import { delay } from 'sbg-utility';

async function main() {
  const browser = await connect();
  const wsEndpoint = browser.wsEndpoint();
  console.log('Connected to browser with WebSocket Endpoint:', wsEndpoint);

  const visit = async (page: Page, url: string) => {
    const maxAttempts = 2;
    const timeoutMs = 30_000;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        console.log(`Visiting ${url} on page ${page.url()} (attempt ${attempt}/${maxAttempts})`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
        console.log('Page title:', await page.title());
        return;
      } catch (error) {
        const isLastAttempt = attempt === maxAttempts;
        console.warn(`Failed visiting ${url} on attempt ${attempt}:`, error);
        if (isLastAttempt) {
          throw error;
        }
        await delay(1_000);
      }
    }
  };

  try {
    // Example: visit a pages
    const initialPages = await browser.pages();
    const initialPage = initialPages[0] ?? (await browser.newPage());
    await visit(initialPage, 'http://bing.com');
    const page = await browser.newPage();
    await visit(page, 'http://example.com');
    const page2 = await browser.newPage();
    await visit(page2, 'http://google.com');

    // Example: List all open pages
    const pages = await browser.pages();
    console.log(`Number of open pages: ${pages.length}`);
    pages.forEach((page, index) => {
      console.log(`Page ${index + 1}: ${page.url()}`);
    });

    await delay(5000); // Keep the browser open for a while to observe
  } catch (e) {
    console.error('Error during page operations:', e);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error('Error launching browser:', error);
  process.exit(1);
});
