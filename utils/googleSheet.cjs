'use strict';

require('../chunk-4IBVXDKH.cjs');
var fs = require('fs-extra');
var path = require('path');
var axios = require('axios');
var xlsx = require('xlsx');
var googleapis = require('googleapis');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var fs__default = /*#__PURE__*/_interopDefault(fs);
var path__default = /*#__PURE__*/_interopDefault(path);
var axios__default = /*#__PURE__*/_interopDefault(axios);
var xlsx__default = /*#__PURE__*/_interopDefault(xlsx);

async function downloadSheets(spreadsheetId, forceDownload = false) {
  const CACHE_DIR = path__default.default.join(process.cwd(), ".cache", "sheets");
  const xlsxFilePath = path__default.default.join(CACHE_DIR, `spreadsheet-pub-${spreadsheetId}.xlsx`);
  const xlsxMetadataPath = path__default.default.join(CACHE_DIR, `spreadsheet-pub-${spreadsheetId}.json`);
  const publicUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx&id=${spreadsheetId}`;
  fs__default.default.ensureDirSync(CACHE_DIR);
  let metadata = {
    csvFiles: []
  };
  if (fs__default.default.existsSync(xlsxMetadataPath)) {
    try {
      metadata = JSON.parse(fs__default.default.readFileSync(xlsxMetadataPath, "utf-8"));
      console.log(`Loaded existing metadata from ${xlsxMetadataPath}`);
    } catch (err) {
      console.error("Failed to parse existing metadata:", err.message || err);
    }
  }
  let shouldDownload = true;
  if (!forceDownload) {
    try {
      const response2 = await axios__default.default.head(publicUrl);
      const remoteMetadata = {
        size: response2.headers["content-length"] || 0
      };
      console.log(`Remote size: ${remoteMetadata.size}, local size: ${metadata.size}`);
      if (fs__default.default.existsSync(xlsxFilePath) && metadata.size == remoteMetadata.size) {
        shouldDownload = false;
      } else {
        metadata = {
          ...metadata,
          ...remoteMetadata
        };
      }
    } catch (err) {
      console.error("Failed to fetch metadata for public export URL:", err.message || err);
    }
  }
  if (!shouldDownload) {
    console.log("Local file is up-to-date, skipping download.");
    return { xlsxFilePath, csvFiles: metadata.csvFiles };
  }
  console.log(`Downloading via public export URL: ${publicUrl}`);
  const response = await axios__default.default.get(publicUrl, { responseType: "stream" });
  const xlsxWriter = fs__default.default.createWriteStream(xlsxFilePath);
  if (typeof response.data.pipe === "function") {
    response.data.pipe(xlsxWriter);
    await new Promise((resolve, reject) => {
      xlsxWriter.on("finish", () => resolve());
      xlsxWriter.on("error", reject);
    });
  } else if (Buffer.isBuffer(response.data)) {
    fs__default.default.writeFileSync(xlsxFilePath, response.data);
  } else {
    fs__default.default.writeFileSync(xlsxFilePath, response.data, "binary");
  }
  console.log(`Saved spreadsheet via public export as XLSX to ${xlsxFilePath}`);
  const workbook = xlsx__default.default.readFile(xlsxFilePath);
  const csvFiles = [];
  workbook.SheetNames.forEach((sheetName) => {
    const csv = xlsx__default.default.utils.sheet_to_csv(workbook.Sheets[sheetName]);
    const csvFilePath = path__default.default.join(CACHE_DIR, `sheet-${sheetName.replace(/[^\w\d-]/g, "_")}.csv`);
    metadata.csvFiles.push(csvFilePath);
    fs__default.default.writeFileSync(csvFilePath, csv, "utf-8");
    csvFiles.push(csvFilePath);
    console.log(`Parsed and saved sheet '${sheetName}' as CSV to ${csvFilePath}`);
  });
  fs__default.default.writeFileSync(xlsxMetadataPath, JSON.stringify(metadata, null, 2), "utf-8");
  console.log(`New spreadsheet metadata saved to ${xlsxMetadataPath}`);
  return { xlsxFilePath, csvFiles, xlsxMetadataPath };
}
function colorNameToRgb(colorName) {
  const colors = {
    red: [1, 0, 0],
    green: [0, 1, 0],
    blue: [0, 0, 1],
    yellow: [1, 1, 0],
    cyan: [0, 1, 1],
    magenta: [1, 0, 1],
    black: [0, 0, 0],
    white: [1, 1, 1],
    gray: [0.5, 0.5, 0.5],
    orange: [1, 0.65, 0],
    pink: [1, 0.75, 0.8],
    purple: [0.5, 0, 0.5],
    lightgreen: [0.56, 0.93, 0.56],
    lightblue: [0.68, 0.85, 0.9]
  };
  const rgb = colors[colorName.toLowerCase()];
  if (!rgb) throw new Error(`Unsupported color name: ${colorName}`);
  return { red: rgb[0], green: rgb[1], blue: rgb[2] };
}
async function changeRowColor(auth, spreadsheetId, sheetId, rowIndex, colorName) {
  const color = colorNameToRgb(colorName);
  const sheets = googleapis.google.sheets({ version: "v4", auth });
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          repeatCell: {
            range: {
              sheetId,
              startRowIndex: rowIndex,
              // inclusive
              endRowIndex: rowIndex + 1
              // exclusive
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: color
              }
            },
            fields: "userEnteredFormat.backgroundColor"
          }
        }
      ]
    }
  });
  console.log(`Row ${rowIndex + 1} color changed to ${colorName}!`);
}

exports.changeRowColor = changeRowColor;
exports.downloadSheets = downloadSheets;
//# sourceMappingURL=googleSheet.cjs.map
//# sourceMappingURL=googleSheet.cjs.map