import { array_random, delay, jsonParseWithCircularRefs, jsonStringifyWithCircularRefs, writefile } from 'sbg-utility';
import path from 'upath';
import cp from 'child_process';
import fs from 'fs-extra';
import puppeteer, { Browser } from 'puppeteer';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const puppeteerTempPath = path.join(process.cwd(), 'tmp/puppeteer');
const launcherLogPath = path.join(puppeteerTempPath, 'launcher.log');
const launchTimeoutMs = 60_000;

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

const endpointFilePath = path.join(puppeteerTempPath, 'endpoint.json');
export function writeEndpoint(endpoint: string) {
  const endpoints = readEndpoints();
  endpoints.push(endpoint);
  writefile(endpointFilePath, jsonStringifyWithCircularRefs(endpoints));
}

export function removeEndpoint(endpoint: string) {
  const endpoints = readEndpoints().filter((item) => item !== endpoint);
  writefile(endpointFilePath, jsonStringifyWithCircularRefs(endpoints));
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
  await launch();
  let endpoints = readEndpoints();

  while (endpoints.length > 0) {
    const endpoint = array_random(endpoints);
    if (!endpoint) {
      break;
    }

    try {
      const browser = await puppeteer.connect({ browserWSEndpoint: endpoint });
      console.log('Successfully connected to browser with endpoint:', browser.wsEndpoint());
      return browser;
    } catch (error: any) {
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
