import path from 'node:path';
import { processData, skrinLogin } from './skrin.js';
import { getPuppeteer } from './src/puppeteer_utils.js';
import { appendLog, getLogData } from './src/utils.js';

// re-test .cache/lastData.log
// 7488 - 8286

// Example usage
const parsedLogs = getLogData();
const newLogPath = path.join(process.cwd(), '.cache', 'newLastData.log');

(async function () {
  let { browser } = await createSession();

  // Optional: Listen for disconnects
  browser.on('disconnected', () => {
    console.error('Puppeteer browser disconnected!');
  });

  try {
    for (let i = 0; i < parsedLogs.length; i++) {
      // Every 25 iterations, close and recreate browser, then re-login
      if (i > 0 && i % 25 === 0) {
        console.log(`Closing browser at iteration ${i}...`);
        await browser.close();
        console.log(`Recreating browser at iteration ${i}...`);
        const session = await createSession();
        browser = session.browser;
        browser.on('disconnected', () => {
          console.error('Puppeteer browser disconnected!');
        });
      }

      const { timestamp, status, data, raw } = parsedLogs[i];
      if (status === 'skipped') {
        await processSkippedData(data, browser);
        appendLog(data, 'Processed Skipped Data', newLogPath);
      } else if (status === 'invalid') {
        console.warn('Invalid data found in log:', { timestamp, data, raw });
        appendLog(data, 'Invalid Data', newLogPath);
      } else {
        console.log('Skipping processed data:', { timestamp, data, raw });
        appendLog(data, 'Processed Data', newLogPath);
      }
    }
  } catch (err) {
    console.error('Fatal error in processing loop:', err);
  } finally {
    if (browser && browser.connected) {
      console.log('Closing browser at end of script...');
      await browser.close();
    }
  }
})();

async function createSession() {
  console.log('Creating new Puppeteer session...');
  let { page, browser } = await getPuppeteer();
  await skrinLogin(page, browser);
  return { page, browser };
}

async function processSkippedData(data, browser) {
  try {
    const result = await processData(browser, data);
    if (result.status === 'error') {
      console.error('Error processing data:', {
        error: result.error || result.message || 'Unknown error',
        data,
        result
      });
    } else if (result.status === 'success') {
      console.log('Data processed successfully:', result.data);
    } else {
      console.warn('Unexpected result status:', result.status, result);
    }
  } catch (err) {
    console.error('Exception in processSkippedData:', err, data);
  }
}
