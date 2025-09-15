'use strict';

require('../chunk-4IBVXDKH.cjs');
var deepmergeTs = require('deepmerge-ts');
var path = require('node:path');
var puppeteer_utils_js = require('../puppeteer_utils.js');
var skrin_js = require('./skrin.js');
var utils_js = require('../utils.js');
var skrin_puppeteer_js = require('../skrin_puppeteer.js');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var path__default = /*#__PURE__*/_interopDefault(path);

async function createSession() {
  console.log("Creating new Puppeteer session...");
  const { page, browser } = await puppeteer_utils_js.getPuppeteer();
  await skrin_puppeteer_js.skrinLogin(page, browser);
  return { page, browser };
}
async function processSkippedData(data, browser) {
  const result = await skrin_js.processData(browser, data);
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
const newLogPath = path__default.default.join(process.cwd(), ".cache", "newLastData.log");
const parsedNewLogs = utils_js.getLogData(newLogPath);
const parsedLogs = utils_js.getLogData();
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
          const mergeData = deepmergeTs.deepmerge(data, modifiedData);
          if (modifiedData.status === "error") {
            console.error("Error processing skipped data:", modifiedData.error || modifiedData.message);
            utils_js.appendLog(mergeData, "Error Processing Skipped Data", newLogPath);
          } else if (modifiedData.status === "success") {
            utils_js.appendLog(mergeData, "Processed Skipped Data", newLogPath);
          } else {
            throw new Error(`Unexpected status from processData: ${modifiedData.status}`);
          }
        } else if (status === "invalid") {
          console.warn("Invalid data found in log:", { timestamp, data, raw });
          utils_js.appendLog(data, "Invalid Data", newLogPath);
        } else {
          console.log("Skipping processed data:", { timestamp, data, raw });
          utils_js.appendLog(data, "Processed Data", newLogPath);
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

exports.newLogPath = newLogPath;
//# sourceMappingURL=skrin.log-restart.cjs.map
//# sourceMappingURL=skrin.log-restart.cjs.map