import { deepmerge } from 'deepmerge-ts';
import path from 'node:path';
import { getPuppeteer } from '../puppeteer_utils.js';
import { processData, skrinLogin } from './skrin.js';
import { appendLog, getLogData } from '../utils.js';

// re-test .cache/lastData.log
// current index range: 7488 - 8286

async function createSession() {
  console.log('Creating new Puppeteer session...');
  const { page, browser } = await getPuppeteer();
  await skrinLogin(page, browser);
  return { page, browser };
}

/**
 * Attempts to reprocess a previously skipped log entry.
 *
 * Logs the result or error details, and returns the outcome of the `processData` function.
 *
 * @async
 * @function
 * @param {import('../../globals.js').ExcelRowData} data - The data entry to be reprocessed.
 * @param {import('puppeteer').Browser} browser - An instance of the Puppeteer browser.
 * @returns {Promise<{status: 'success' | 'error', data?: any, error?: any, message?: string}>}
 * Resolves with the result of processing, or throws an error if an exception occurs.
 */
async function processSkippedData(data, browser) {
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
  return result;
}

// from 7512
export const newLogPath = path.join(process.cwd(), '.cache', 'newLastData.log');
const parsedNewLogs = getLogData(newLogPath);
const parsedLogs = getLogData();
// Build a Set of nik values from parsedNewLogs
const newNikSet = new Set(parsedNewLogs.map((item) => item.data && item.data.nik));
// Filter parsedLogs to exclude items already in parsedNewLogs by nik
const filteredLogs = parsedLogs.filter((item) => item.data && !newNikSet.has(item.data.nik));

if (process.argv.some((arg) => arg.includes('log-restart'))) {
  (async function () {
    let { browser } = await createSession();

    // Optional: Listen for disconnects
    browser.on('disconnected', () => {
      console.error('Puppeteer browser disconnected!');
    });

    try {
      for (let i = 0; i < filteredLogs.length; i++) {
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

        const { timestamp, status, data, raw } = filteredLogs[i];
        if (status === 'skipped') {
          const modifiedData = await processSkippedData(data, browser);
          if (!modifiedData) {
            throw new Error(`No modified data returned for skipped item: ${JSON.stringify(filteredLogs[i])}`);
          }
          const mergeData = deepmerge(data, modifiedData);
          if (modifiedData.status === 'error') {
            console.error('Error processing skipped data:', modifiedData.error || modifiedData.message);
            appendLog(mergeData, 'Error Processing Skipped Data', newLogPath);
          } else if (modifiedData.status === 'success') {
            appendLog(mergeData, 'Processed Skipped Data', newLogPath);
          } else {
            throw new Error(`Unexpected status from processData: ${modifiedData.status}`);
          }
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
}
