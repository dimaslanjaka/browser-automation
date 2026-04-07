const path = require('path');
const fs = require('fs');

/**
 * @type {import("puppeteer").Configuration}
 */
const config = {
  // Cache location for Puppeteer.
  cacheDirectory: path.join(__dirname, '.cache', 'puppeteer'),
  // Download Chrome (default `skipDownload: false`).
  chrome: {
    skipDownload: true
  },
  // Download Firefox (default `skipDownload: true`).
  firefox: {
    skipDownload: true
  },
  temporaryDirectory: path.join(__dirname, 'tmp/puppeteer')
};

fs.mkdirSync(config.cacheDirectory, { recursive: true });
fs.mkdirSync(config.temporaryDirectory, { recursive: true });

module.exports = config;
module.exports.default = config;
module.exports.puppeteerConfig = config;
module.exports.puppeteerTempPath = config.temporaryDirectory;
