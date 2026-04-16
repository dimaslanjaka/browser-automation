import cp from 'child_process';
import fs from 'fs-extra';
import puppeteer, { Browser } from 'puppeteer';
import { delay } from 'sbg-utility';
import path from 'upath';
import { fileURLToPath } from 'url';
import EndpointManager from './EndpointManager.js';
import { puppeteerTempPath } from '../../../.puppeteerrc.cjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const launcherLogPath = path.join(puppeteerTempPath, 'launcher.log');
const launchTimeoutMs = 60_000;
export const endpointManager = new EndpointManager(puppeteerTempPath);

/**
 * Check whether a process with the given PID is currently running.
 *
 * Uses `process.kill(pid, 0)` which does not terminate the process but
 * will throw if the process does not exist or the caller lacks permission.
 *
 * @param pid - Process id to check
 * @returns `true` if the process appears to be running, otherwise `false`
 */
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function launch() {
  const cwd = process.cwd();
  const jsLauncherPath = path.join(__dirname, 'launcher.js');
  const tsLauncherPath = path.join(__dirname, 'launcher.ts');
  const hasJsLauncher = fs.existsSync(jsLauncherPath);
  const launcherPath = hasJsLauncher ? jsLauncherPath : tsLauncherPath;
  const args = hasJsLauncher
    ? [launcherPath]
    : ['--no-warnings=ExperimentalWarning', '--loader', 'ts-node/esm', launcherPath];

  fs.ensureDirSync(puppeteerTempPath);
  const logFd = fs.openSync(launcherLogPath, 'a');

  const child = cp.spawn(process.execPath, args, {
    detached: true,
    shell: false,
    stdio: ['ignore', logFd, logFd],
    cwd
  });
  const pid = child.pid;
  if (!pid) {
    fs.closeSync(logFd);
    throw new Error('Failed to start launcher process: child PID is undefined.');
  }

  fs.closeSync(logFd);
  const runningIndicatorPath = path.join(puppeteerTempPath, 'browser-running', pid.toString());
  child.unref();
  const waitStart = Date.now();
  console.log(''); // add a line break before the waiting message

  // wait until indicator file is created by the launcher to ensure the browser is ready
  while (!fs.existsSync(runningIndicatorPath)) {
    if (!isProcessRunning(pid)) {
      process.stdout.write('\n');
      throw new Error(`Launcher process (PID: ${pid}) exited before initialization. Check log: ${launcherLogPath}`);
    }

    const elapsedMs = Date.now() - waitStart;
    if (elapsedMs > launchTimeoutMs) {
      process.stdout.write('\n');
      throw new Error(
        `Timed out waiting ${Math.round(launchTimeoutMs / 1000)}s for browser process (PID: ${pid}) to initialize. Check log: ${launcherLogPath}`
      );
    }

    const elapsedSeconds = ((Date.now() - waitStart) / 1000).toFixed(1);
    process.stdout.write(
      `\rLaunching browser process with PID: ${pid}, waiting for it to initialize... (${elapsedSeconds}s elapsed)`
    );
    await delay(100);
  }
  process.stdout.write('\n');
  console.log(`Browser process with PID: ${pid} is ready.`);
}

export async function connect(): Promise<Browser> {
  let endpoints = await endpointManager.getAllActiveEndpoints();
  const ownerPid = process.pid;

  if (!endpoints.length) {
    await launch();
    endpoints = await endpointManager.getAllActiveEndpoints();
  }

  while (true) {
    if (!endpoints.length) {
      await launch();
      endpoints = await endpointManager.getAllActiveEndpoints();
      if (!endpoints.length) {
        throw new Error('No browser endpoint is available to connect.');
      }
    }

    const freeEndpoints = endpoints.filter((item) => !item.locked && item.puppeteerAvailable);
    if (!freeEndpoints.length) {
      await launch();
      endpoints = await endpointManager.getAllActiveEndpoints();
      continue;
    }

    const endpoint = freeEndpoints[0]?.endpoint;
    if (!endpoint) {
      break;
    }

    const claimed = endpointManager.tryClaimEndpoint(endpoint, ownerPid);
    if (!claimed) {
      endpoints = endpoints.filter((item) => item.endpoint !== endpoint);
      continue;
    }

    try {
      const browser = await puppeteer.connect({ browserWSEndpoint: endpoint });
      browser.once('disconnected', () => {
        endpointManager.releaseEndpointClaim(endpoint, ownerPid);
      });
      console.log('Successfully connected to browser with endpoint:', browser.wsEndpoint());
      return browser;
    } catch (error: any) {
      endpointManager.releaseEndpointClaim(endpoint, ownerPid);
      const err = error?.error || error;
      if (err?.code === 'ECONNREFUSED') {
        endpointManager.removeEndpoint(endpoint);
        endpoints = endpoints.filter((item) => item.endpoint !== endpoint);
        if (!endpoints.length) {
          await launch();
          endpoints = await endpointManager.getAllActiveEndpoints();
        }
        continue;
      }

      throw error;
    }
  }

  throw new Error('No browser endpoint is available to connect.');
}
