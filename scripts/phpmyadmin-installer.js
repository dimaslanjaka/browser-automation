/**
 * Auto download and extract phpMyAdmin with Node.js
 */
import fs from 'fs';
import path from 'path';
import https from 'https';
import { execSync } from 'child_process';

const CWD = process.cwd();
const TMP_DIR = path.join(CWD, 'tmp', 'download');
const DOWNLOAD_FILE = path.join(TMP_DIR, 'phpmyadmin.zip');
const EXTRACT_DIR = path.join(CWD, 'phpmyadmin');

// Hardcoded phpMyAdmin version and URL
const PHPMYADMIN_VERSION = '5.2.2';
const PHPMYADMIN_URL = `https://files.phpmyadmin.net/phpMyAdmin/${PHPMYADMIN_VERSION}/phpMyAdmin-${PHPMYADMIN_VERSION}-all-languages.zip`;

/**
 * Get remote file size (works for most servers, but phpMyAdmin supports HEAD)
 */
async function getRemoteFileSize(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { method: 'HEAD' }, (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error(`Failed to fetch HEAD: ${res.statusCode}`));
        }
        resolve(parseInt(res.headers['content-length'] || '0', 10));
      })
      .on('error', reject);
  });
}

/**
 * Download file
 */
async function downloadFile(url, output) {
  console.log(`Downloading: ${url}`);
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(output);
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(output);
          return reject(new Error(`Failed to download: ${res.statusCode}`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', (err) => {
        file.close();
        fs.unlinkSync(output);
        reject(err);
      });
  });
}

/**
 * Extract zip file using system tools (PowerShell on Windows, unzip on others)
 */
async function extractZip(zipFile, targetDir) {
  console.log(`Extracting to ${targetDir} ...`);
  if (process.platform === 'win32') {
    execSync(`powershell -Command "Expand-Archive -Path '${zipFile}' -DestinationPath '${targetDir}' -Force"`, {
      stdio: 'inherit'
    });
  } else {
    execSync(`unzip -o '${zipFile}' -d '${targetDir}'`, { stdio: 'inherit' });
  }
  console.log('Extraction complete.');
}

/**
 * Main
 */
async function main() {
  try {
    console.log(`phpMyAdmin version: ${PHPMYADMIN_VERSION}`);
    console.log(`Download URL: ${PHPMYADMIN_URL}`);

    // Ensure tmp and target directories exist
    fs.mkdirSync(TMP_DIR, { recursive: true });
    fs.mkdirSync(EXTRACT_DIR, { recursive: true });

    // Download only if remote and local size differ
    let localSize = 0;
    if (fs.existsSync(DOWNLOAD_FILE)) {
      localSize = fs.statSync(DOWNLOAD_FILE).size;
    }
    let remoteSize = 0;
    try {
      remoteSize = await getRemoteFileSize(PHPMYADMIN_URL);
    } catch {
      console.warn('Warning: Could not get remote file size, will download anyway.');
      remoteSize = -1;
    }
    if (remoteSize !== localSize) {
      console.log('File size differs. Downloading phpMyAdmin...');
      await downloadFile(PHPMYADMIN_URL, DOWNLOAD_FILE);
    } else {
      console.log('Local file is up to date. Skipping download.');
    }

    await extractZip(DOWNLOAD_FILE, EXTRACT_DIR);

    console.log('Done ✅ (zip kept in tmp/download)');
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
