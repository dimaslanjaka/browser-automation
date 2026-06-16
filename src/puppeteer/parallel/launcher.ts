import path from 'path';
import type { Page } from 'puppeteer';
import { connect } from 'puppeteer-real-browser';
import { writefile } from 'sbg-utility';
import { fileURLToPath } from 'url';
import { closeOtherTabs } from '../../puppeteer_utils.js';
import goWithRetry from '../goWithRetry.js';
import { GLOBAL_PROFILES_DIR, GLOBAL_PUPPETEER_DIR } from '../profile-manager.js';
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
}

export async function useDefault() {
  const { browser } = await connect({
    headless: false,
    turnstile: true,
    disableXvfb: false,
    ignoreAllFlags: false,
    customConfig: {
      userDataDir: path.resolve(GLOBAL_PROFILES_DIR, 'profile1')
    }
  });

  const goto = async (pageOrUrl: string | Page, url?: string | GotoOptions, options?: GotoOptions) => {
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
  const { browser, goto } = await useDefault();

  await goto('http://sh.webmanajemen.com', { timeout: 10000, waitUntil: 'networkidle2' }).catch(console.log);
  await closeOtherTabs(browser as any, 1);

  // Detect when new targets (pages, workers, etc.) are created/destroyed/changed.
  browser.on('targetcreated', async (target) => {
    try {
      console.log('Target created:', target.type(), target.url());
      if (target.type() === 'page') {
        const pageFromTarget = await target.page();
        if (pageFromTarget) console.log('New page target URL:', pageFromTarget.url());
      }
    } catch (err) {
      console.error('Error handling targetcreated:', err);
    }
    // refresh endpoint file when targets change
    try {
      endpointManager.writeEndpoint(browser.wsEndpoint());
    } catch (e) {
      console.error('Failed to refresh endpoint on targetcreated:', e);
    }
  });

  browser.on('targetdestroyed', (target) => {
    try {
      console.log('Target destroyed:', target.type(), target.url());
    } catch (err) {
      console.error('Error handling targetdestroyed:', err);
    }
    try {
      endpointManager.writeEndpoint(browser.wsEndpoint());
    } catch (e) {
      console.error('Failed to refresh endpoint on targetdestroyed:', e);
    }
  });

  browser.on('targetchanged', (target) => {
    try {
      console.log('Target changed:', target.type(), target.url());
    } catch (err) {
      console.error('Error handling targetchanged:', err);
    }
    try {
      endpointManager.writeEndpoint(browser.wsEndpoint());
    } catch (e) {
      console.error('Failed to refresh endpoint on targetchanged:', e);
    }
  });

  // Write the WebSocket endpoint to a file for other processes to connect
  const wsEndpoint = browser.wsEndpoint();
  console.log('WebSocket Endpoint:', wsEndpoint);
  endpointManager.writeEndpoint(wsEndpoint);

  // Remove unavailable endpoints after registering the new one
  const endpoints = await endpointManager.getAllActiveEndpoints().catch(() => []);
  for (const item of endpoints) {
    if (!item.puppeteerAvailable && item.endpoint !== wsEndpoint) {
      endpointManager.removeEndpoint(item.endpoint);
      console.log('Removed unavailable endpoint:', item.endpoint);
    }
  }

  // Write indicator file to signal that the browser is running
  const runningIndicatorPath = path.join(GLOBAL_PUPPETEER_DIR, 'browser-running', process.pid.toString());
  writefile(runningIndicatorPath, 'Browser is running');
  console.log(`Browser running indicator created at: ${runningIndicatorPath}`);

  // Keep the process alive until the browser is closed
  await new Promise((resolve) => {
    browser?.on('disconnected', () => {
      endpointManager.removeEndpoint(wsEndpoint);
      resolve(true);
    });
    // Listen for process disconnects from clients (e.g., skrin.runner.ts)
    process.on('SIGINT', () => {
      endpointManager.removeEndpoint(wsEndpoint);
      console.log('SIGINT received, released endpoint:', wsEndpoint);
      resolve(true);
    });
    process.on('SIGTERM', () => {
      endpointManager.removeEndpoint(wsEndpoint);
      console.log('SIGTERM received, released endpoint:', wsEndpoint);
      resolve(true);
    });
    process.on('exit', () => {
      endpointManager.removeEndpoint(wsEndpoint);
      console.log('Process exit, released endpoint:', wsEndpoint);
      resolve(true);
    });
  });
}
