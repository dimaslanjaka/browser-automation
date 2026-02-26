// Source - https://stackoverflow.com/a/55556220
// Posted by Keith
// Retrieved 2026-02-27, License - CC BY-SA 4.0

import fs from 'fs';
import path from 'path';
import puppeteer, { Browser } from 'puppeteer';
import { writefile } from 'sbg-utility';
import { getFallbackProfileDir, isUserDataDirInUse, userDataDir } from '../puppeteer_utils.js';
import { puppeteerTempPath, removeEndpoint, writeEndpoint } from './utils.js';

(async () => {
  const launch_options = {
    args: ['--disable-features=site-per-process'],
    headless: false,
    devtools: false,
    defaultViewport: { width: 1200, height: 1000 },
    userDataDir: userDataDir
  };

  const defaultUserDataDirPath = path.resolve(userDataDir);
  const launchUserDataDirPath = launch_options.userDataDir ? path.resolve(launch_options.userDataDir) : '';
  const usesDefaultUserDataDir = launchUserDataDirPath === defaultUserDataDirPath;

  if (usesDefaultUserDataDir && isUserDataDirInUse(launchUserDataDirPath)) {
    const fallbackUserDataDir = getFallbackProfileDir();
    fs.mkdirSync(fallbackUserDataDir, { recursive: true });
    console.warn(`Default userDataDir is currently in use, switching to fallback profile: ${fallbackUserDataDir}`);
    launch_options.userDataDir = fallbackUserDataDir;
  }

  let browser: Browser | null = null;
  try {
    browser = await puppeteer.launch(launch_options);
  } catch (error) {
    const errorMessage = String((error as Error)?.message || error || '').toLowerCase();
    const isProfileInUseError =
      errorMessage.includes('already running for') ||
      errorMessage.includes('userdatadir') ||
      errorMessage.includes('user data dir');

    if (usesDefaultUserDataDir && isProfileInUseError) {
      const fallbackUserDataDir = getFallbackProfileDir();
      fs.mkdirSync(fallbackUserDataDir, { recursive: true });
      console.warn(`Launch failed because default userDataDir is busy, retrying with: ${fallbackUserDataDir}`);
      browser = await puppeteer.launch({ ...launch_options, userDataDir: fallbackUserDataDir });
    } else {
      throw error;
    }
  }

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
