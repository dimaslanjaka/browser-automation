import path from 'path';
import { writefile } from 'sbg-utility';
import { getPuppeteer, userDataDir } from '../puppeteer_utils.js';
import { puppeteerTempPath, removeEndpoint, writeEndpoint } from './utils.js';

(async () => {
  const { browser, page } = await getPuppeteer({
    args: ['--disable-features=site-per-process'],
    headless: false,
    devtools: false,
    defaultViewport: { width: 1200, height: 1000 },
    userDataDir,
    reuse: false,
    autoSwitchProfileDir: true
  });

  await page.close();

  // Write the WebSocket endpoint to a file for other processes to connect
  const wsEndpoint = browser.wsEndpoint();
  console.log('WebSocket Endpoint:', wsEndpoint);
  writeEndpoint(wsEndpoint);

  // Write indicator file to signal that the browser is running
  const runningIndicatorPath = path.join(puppeteerTempPath, 'browser-running', process.pid.toString());
  writefile(runningIndicatorPath, 'Browser is running');
  console.log(`Browser running indicator created at: ${runningIndicatorPath}`);

  // Keep the process alive until the browser is closed
  await new Promise((resolve) => {
    browser?.on('disconnected', () => {
      removeEndpoint(wsEndpoint);
      resolve(true);
    });
  });
})();
