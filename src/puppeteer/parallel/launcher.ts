import path from 'path';
import { connect } from 'puppeteer-real-browser';
import { writefile } from 'sbg-utility';
import { fileURLToPath } from 'url';
import { closeOtherTabs } from '../../puppeteer_utils.js';
import goWithRetry from '../goWithRetry.js';
import { GLOBAL_PROFILES_DIR, GLOBAL_PUPPETEER_DIR, reserveClusterUserDataDir } from '../profile-manager.js';
import { endpointManager } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface GotoOptions {
  retries?: number;
  timeout?: number;
  waitUntil?: string | string[];
  cookie?: import('../Cookies.js').PuppeteerCookies;
  retryDelay?: number;
  onRetry?: Function;
  url?: string;
}

export async function useDefault() {
  const userDataDir = reserveClusterUserDataDir({
    preferredUserDataDir: path.resolve(GLOBAL_PROFILES_DIR, 'profile1'),
    reservedUserDataDirs: new Set(),
    autoSwitchProfileDir: true
  });
  console.log('User Data Dir', userDataDir);

  const { browser } = await connect({
    headless: false,
    turnstile: true,
    disableXvfb: false,
    ignoreAllFlags: false,
    customConfig: { userDataDir },
    connectOption: { protocolTimeout: 180_000 }
  });

  const goto = async (pageOrUrl: any, url?: string | GotoOptions, options?: GotoOptions) => {
    if (typeof pageOrUrl === 'string') {
      const page = await browser.newPage();
      return goWithRetry(page as any, pageOrUrl, typeof url === 'object' ? url : {});
    }
    return goWithRetry(pageOrUrl, typeof url === 'string' ? url : '', options);
  };

  return { browser, goto };
}

/**
 * Launches a Puppeteer browser instance in the background for parallel usage.
 *
 * Opens a maximized browser with stealth mode enabled, navigates to the
 * initial URL, and sets up target lifecycle listeners (`targetcreated`,
 * `targetdestroyed`, `targetchanged`) that refresh the shared WebSocket
 * endpoint file whenever targets change.
 *
 * After the browser is ready the function:
 * - Writes the browser's WebSocket endpoint so other processes can connect
 * - Removes stale/unavailable endpoints from the registry
 * - Creates a PID-based running-indicator file under `GLOBAL_PUPPETEER_DIR`
 *
 * The returned promise never resolves — it keeps the process alive until the
 * browser disconnects or the process receives `SIGINT`, `SIGTERM`, or `exit`,
 * at which point the endpoint is cleaned up.
 */
export async function parallelLauncher() {
  const { browser } = await useDefault();

  await closeOtherTabs(browser as any, 1);

  const [initialPage] = await browser.pages();

  const warmupUrls = [
    { url: 'http://www.webmanajemen.com', page: initialPage },
    { url: 'https://www.apivoid.com/tools/bot-detection-test/' },
    { url: 'https://www.scrapingcourse.com/antibot-challenge' },
    { url: 'https://bot.sannysoft.com' }
  ];

  for (const { url, page } of warmupUrls) {
    const target = page ?? (await browser.newPage());
    await goWithRetry(target as any, url, {
      waitUntil: 'networkidle2',
      timeout: 10000
    }).catch(console.log);
  }

  const logTarget = (event: string) => async (target: any) => {
    try {
      console.log(`Target ${event}:`, target.type(), target.url());
      if (event === 'created' && target.type() === 'page') {
        const pageFromTarget = await target.page();
        if (pageFromTarget) console.log('New page target URL:', pageFromTarget.url());
      }
    } catch (err) {
      console.error(`Error handling target${event}:`, err);
    }
  };

  browser.on('targetcreated', logTarget('created'));
  browser.on('targetdestroyed', logTarget('destroyed'));
  browser.on('targetchanged', logTarget('changed'));

  const wsEndpoint = browser.wsEndpoint();
  console.log('WebSocket Endpoint:', wsEndpoint);
  endpointManager.writeEndpoint(wsEndpoint);

  const endpoints = await endpointManager.getAllActiveEndpoints().catch(() => []);
  for (const item of endpoints) {
    if (!item.puppeteerAvailable && item.endpoint !== wsEndpoint) {
      endpointManager.removeEndpoint(item.endpoint);
      console.log('Removed unavailable endpoint:', item.endpoint);
    }
  }

  const runningIndicatorPath = path.join(GLOBAL_PUPPETEER_DIR, 'browser-running', process.pid.toString());
  writefile(runningIndicatorPath, 'Browser is running');
  console.log(`Browser running indicator created at: ${runningIndicatorPath}`);

  await new Promise<void>((resolve) => {
    const release = (reason: string) => () => {
      endpointManager.removeEndpoint(wsEndpoint);
      console.log(`${reason}, released endpoint:`, wsEndpoint);
      resolve();
    };

    browser.on('disconnected', release('Browser disconnected'));
    process.once('SIGINT', release('SIGINT'));
    process.once('SIGTERM', release('SIGTERM'));
    process.once('exit', release('Process exit'));
  });
}
