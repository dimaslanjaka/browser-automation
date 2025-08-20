const path = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */

const cacheDir = path.join(__dirname, '.cache', 'puppeteer');
const fs = require('fs');
if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

const config = {
  // Cache location for Puppeteer.
  cacheDirectory: cacheDir
};

module.exports = config;
