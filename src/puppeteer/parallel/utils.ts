import { delay, jsonParseWithCircularRefs, jsonStringifyWithCircularRefs, writefile } from 'sbg-utility';
import path from 'upath';
import cp from 'child_process';
import fs from 'fs-extra';
import puppeteer, { Browser } from 'puppeteer';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const puppeteerTempPath = path.join(process.cwd(), 'tmp/puppeteer');
const launcherLogPath = path.join(puppeteerTempPath, 'launcher.log');
const endpointLocksPath = path.join(puppeteerTempPath, 'endpoint-locks');
const launchTimeoutMs = 60_000;

type EndpointLock = {
  ownerPid: number;
  claimedAt: string;
};

function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function parseEndpoints(content: string): string[] {
  if (!content) {
    return [];
  }

  return jsonParseWithCircularRefs<string[]>(content);
}

function getEndpointLockPath(endpoint: string) {
  return path.join(endpointLocksPath, `${encodeURIComponent(endpoint)}.json`);
}

function readEndpointLock(endpoint: string): EndpointLock | undefined {
  const lockPath = getEndpointLockPath(endpoint);

  try {
    const content = fs.readFileSync(lockPath, 'utf8').trim();
    if (!content) {
      return undefined;
    }

    return jsonParseWithCircularRefs<EndpointLock>(content);
  } catch {
    return undefined;
  }
}

function getActiveEndpointLock(endpoint: string): EndpointLock | undefined {
  const lockPath = getEndpointLockPath(endpoint);
  const lock = readEndpointLock(endpoint);
  if (!lock?.ownerPid) {
    fs.removeSync(lockPath);
    return undefined;
  }

  if (!isProcessRunning(lock.ownerPid)) {
    fs.removeSync(lockPath);
    return undefined;
  }

  return lock;
}

function isEndpointLocked(endpoint: string): boolean {
  return Boolean(getActiveEndpointLock(endpoint));
}

function tryClaimEndpoint(endpoint: string, ownerPid: number): boolean {
  fs.ensureDirSync(endpointLocksPath);
  const lockPath = getEndpointLockPath(endpoint);

  const existingLock = getActiveEndpointLock(endpoint);
  if (existingLock?.ownerPid && existingLock.ownerPid !== ownerPid) {
    return false;
  }

  const payload: EndpointLock = {
    ownerPid,
    claimedAt: new Date().toISOString()
  };

  try {
    const fd = fs.openSync(lockPath, 'wx');
    fs.writeFileSync(fd, jsonStringifyWithCircularRefs(payload));
    fs.closeSync(fd);
    return true;
  } catch (error: any) {
    if (error?.code === 'EEXIST') {
      return false;
    }

    throw error;
  }
}

function releaseEndpointClaim(endpoint: string, ownerPid: number) {
  const lockPath = getEndpointLockPath(endpoint);
  const lock = readEndpointLock(endpoint);
  if (!lock?.ownerPid) {
    fs.removeSync(lockPath);
    return;
  }

  if (lock.ownerPid !== ownerPid && isProcessRunning(lock.ownerPid)) {
    return;
  }

  fs.removeSync(lockPath);
}

export function readEndpointStatus() {
  return readEndpoints().map((endpoint) => {
    const lock = getActiveEndpointLock(endpoint);
    return {
      endpoint,
      inUse: Boolean(lock),
      ownerPid: lock?.ownerPid
    };
  });
}

const endpointFilePath = path.join(puppeteerTempPath, 'endpoint.json');
export function writeEndpoint(endpoint: string) {
  const endpoints = readEndpoints();
  const uniqueEndpoints = Array.from(new Set([...endpoints, endpoint]));
  writefile(endpointFilePath, jsonStringifyWithCircularRefs(uniqueEndpoints));
}

export function removeEndpoint(endpoint: string) {
  const endpoints = readEndpoints().filter((item) => item !== endpoint);
  writefile(endpointFilePath, jsonStringifyWithCircularRefs(endpoints));
  releaseEndpointClaim(endpoint, process.pid);
}

export function readEndpoints(): string[] {
  let content = '';

  try {
    content = fs.readFileSync(endpointFilePath, 'utf8').trim();
  } catch {
    return [];
  }

  return parseEndpoints(content);
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
  let endpoints = readEndpoints();
  const ownerPid = process.pid;

  if (!endpoints.length) {
    await launch();
    endpoints = readEndpoints();
  }

  while (true) {
    if (!endpoints.length) {
      await launch();
      endpoints = readEndpoints();
      if (!endpoints.length) {
        throw new Error('No browser endpoint is available to connect.');
      }
    }

    const freeEndpoints = endpoints.filter((item) => !isEndpointLocked(item));
    if (!freeEndpoints.length) {
      await launch();
      endpoints = readEndpoints();
      continue;
    }

    const endpoint = freeEndpoints[0];
    if (!endpoint) {
      break;
    }

    const claimed = tryClaimEndpoint(endpoint, ownerPid);
    if (!claimed) {
      endpoints = endpoints.filter((item) => item !== endpoint);
      continue;
    }

    try {
      const browser = await puppeteer.connect({ browserWSEndpoint: endpoint });
      browser.once('disconnected', () => {
        releaseEndpointClaim(endpoint, ownerPid);
      });
      console.log('Successfully connected to browser with endpoint:', browser.wsEndpoint());
      return browser;
    } catch (error: any) {
      releaseEndpointClaim(endpoint, ownerPid);
      const err = error?.error || error;
      if (err?.code === 'ECONNREFUSED') {
        removeEndpoint(endpoint);
        endpoints = endpoints.filter((item) => item !== endpoint);
        if (!endpoints.length) {
          await launch();
          endpoints = readEndpoints();
        }
        continue;
      }

      throw error;
    }
  }

  throw new Error('No browser endpoint is available to connect.');
}
