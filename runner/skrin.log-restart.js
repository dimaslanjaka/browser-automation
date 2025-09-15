import '../chunk-BUSYA2B4.js';
import { deepmerge } from 'deepmerge-ts';
import path from 'node:path';
import { getPuppeteer } from '../puppeteer_utils.js';
import { processData } from './skrin.js';
import { getLogData, appendLog } from '../utils.js';
import { skrinLogin } from '../skrin_puppeteer.js';

async function createSession() {
  console.log("Creating new Puppeteer session...");
  const { page, browser } = await getPuppeteer();
  await skrinLogin(page, browser);
  return { page, browser };
}
async function processSkippedData(data, browser) {
  const result = await processData(browser, data);
  if (result.status === "error") {
    console.error("Error processing data:", {
      error: result.error || result.message || "Unknown error",
      data,
      result
    });
  } else if (result.status === "success") {
    console.log("Data processed successfully:", result.data);
  } else {
    console.warn("Unexpected result status:", result.status, result);
  }
  return result;
}
const newLogPath = path.join(process.cwd(), ".cache", "newLastData.log");
const parsedNewLogs = getLogData(newLogPath);
const parsedLogs = getLogData();
const newNikSet = new Set(parsedNewLogs.map((item) => item.data && item.data.nik));
const filteredLogs = parsedLogs.filter((item) => item.data && !newNikSet.has(item.data.nik));
if (process.argv.some((arg) => arg.includes("log-restart"))) {
  (async function() {
    let { browser } = await createSession();
    browser.on("disconnected", () => {
      console.error("Puppeteer browser disconnected!");
    });
    try {
      for (let i = 0; i < filteredLogs.length; i++) {
        if (i > 0 && i % 25 === 0) {
          console.log(`Closing browser at iteration ${i}...`);
          await browser.close();
          console.log(`Recreating browser at iteration ${i}...`);
          const session = await createSession();
          browser = session.browser;
          browser.on("disconnected", () => {
            console.error("Puppeteer browser disconnected!");
          });
        }
        const { timestamp, status, data, raw } = filteredLogs[i];
        if (status === "skipped") {
          const modifiedData = await processSkippedData(data, browser);
          if (!modifiedData) {
            throw new Error(`No modified data returned for skipped item: ${JSON.stringify(filteredLogs[i])}`);
          }
          const mergeData = deepmerge(data, modifiedData);
          if (modifiedData.status === "error") {
            console.error("Error processing skipped data:", modifiedData.error || modifiedData.message);
            appendLog(mergeData, "Error Processing Skipped Data", newLogPath);
          } else if (modifiedData.status === "success") {
            appendLog(mergeData, "Processed Skipped Data", newLogPath);
          } else {
            throw new Error(`Unexpected status from processData: ${modifiedData.status}`);
          }
        } else if (status === "invalid") {
          console.warn("Invalid data found in log:", { timestamp, data, raw });
          appendLog(data, "Invalid Data", newLogPath);
        } else {
          console.log("Skipping processed data:", { timestamp, data, raw });
          appendLog(data, "Processed Data", newLogPath);
        }
      }
    } catch (err) {
      console.error("Fatal error in processing loop:", err);
    } finally {
      if (browser && browser.connected) {
        console.log("Closing browser at end of script...");
        await browser.close();
      }
    }
  })();
}

export { newLogPath };
//# sourceMappingURL=skrin.log-restart.js.map
//# sourceMappingURL=skrin.log-restart.js.map