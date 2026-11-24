import minimist from 'minimist';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { writefile } from 'sbg-utility';
import { fileURLToPath } from 'url';
import { closeOtherTabs } from '../../puppeteer_utils.js';
import goWithRetry from '../goWithRetry.js';
import { GLOBAL_PROFILES_DIR, GLOBAL_PUPPETEER_DIR, reserveClusterUserDataDir } from '../profile-manager.js';
import { endpointManager } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use stealth plugin
puppeteer.use(StealthPlugin());

// CLI parsing
const argv = minimist(process.argv.slice(2), {
  boolean: ['help', 'headless'],
  string: ['port', 'profile'],
  alias: {
    h: 'help',
    p: 'port',
    H: 'headless',
    P: 'profile'
  },
  default: { help: false, port: '9222', headless: false, profile: 'agent-profile' }
});

function printHelp() {
  const examples = ['Examples:'];
  const ext = path.extname(__filename);
  if (ext === '.ts' || ext === '.tsx') {
    examples.push(
      `  node --no-warnings=ExperimentalWarning --loader ts-node/esm -r ./.vscode/js-hook.cjs "${__filename}" --help`,
      `  npx -y tsx -r ./.vscode/js-hook.cjs "${__filename}" --help`,
      `  npx -y tsx -r ./.vscode/js-hook.cjs "${__filename}" --port=9222 --profile=agent-profile`,
      `  npx -y tsx -r ./.vscode/js-hook.cjs "${__filename}" -p 9222 -P agent-profile -H`
    );
  } else {
    examples.push(`  node "${__filename}" --help`);
  }
  const helpLines = [
    `Usage: node "${__filename}" [options]`,
    '',
    'Options:',
    '  --help, -h              Show this help message',
    '  --port, -p <port>       Remote debugging port (default: 9222)',
    '  --profile, -P <name>    Profile directory name (default: agent-profile)',
    '  --headless, -H          Run headless (default: false)',
    '',
    'Notes:',
    '  - Launches a Puppeteer browser with fixed remote debugging port for MCP connection',
    '  - Other tools can connect via CDP at http://localhost:<port>',
    '  - Browser stays running until process receives SIGINT, SIGTERM, or exit',
    '',
    ...examples
  ];
  console.log(helpLines.join('\n'));
}

if (argv.help) {
  printHelp();
  process.exit(0);
}

// Custom port from CLI
const customPort = argv.port ? parseInt(argv.port, 10) : 9222;
if (isNaN(customPort) || customPort < 1 || customPort > 65535) {
  console.error('Invalid port:', argv.port);
  process.exit(1);
}

const profileName = argv.profile;
const headless = argv.headless;

export interface AgentGotoOptions {
  retries?: number;
  timeout?: number;
  waitUntil?: string | string[];
  cookie?: import('../Cookies.js').PuppeteerCookies;
  retryDelay?: number;
  onRetry?: Function;
  url?: string;
}

export async function useAgentProfile(customPort: number, profileName: string, headless: boolean) {
  const rawUserDataDir = reserveClusterUserDataDir({
    preferredUserDataDir: path.resolve(GLOBAL_PROFILES_DIR, profileName),
    reservedUserDataDirs: new Set(),
    autoSwitchProfileDir: true
  });
  const userDataDir = path.resolve(rawUserDataDir).replace(/\\/g, '/');
  console.log('User Data Dir', userDataDir);
  console.log('Remote Debugging Port', customPort);

  const browser = await puppeteer.launch({
    headless,
    args: [
      `--remote-debugging-port=${customPort}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-ipc-flooding-protection'
    ],
    userDataDir,
    protocolTimeout: 180_000
  });

  const goto = async (pageOrUrl: any, url?: string | AgentGotoOptions, options?: AgentGotoOptions) => {
    if (typeof pageOrUrl === 'string') {
      const page = await browser.newPage();
      return goWithRetry(page as any, pageOrUrl, typeof url === 'object' ? url : {});
    }
    return goWithRetry(pageOrUrl, typeof url === 'string' ? url : '', options);
  };

  return { browser, goto };
}

/**
 * Launches a Puppeteer browser instance with fixed remote debugging port for agent/MCP collaboration.
 *
 * The browser exposes CDP at http://localhost:<port> so external tools (Chrome DevTools MCP,
 * Playwright, etc.) can connect and interact with the same browser session.
 *
 * After the browser is ready the function:
 * - Writes the browser's WebSocket endpoint so other processes can connect
 * - Creates a PID-based running-indicator file under `GLOBAL_PUPPETEER_DIR`
 *
 * The returned promise never resolves — it keeps the process alive until the
 * browser disconnects or the process receives `SIGINT`, `SIGTERM`, or `exit`,
 * at which point the endpoint is cleaned up.
 */
export async function parallelLauncherAgent() {
  const { browser } = await useAgentProfile(customPort, profileName, headless);

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

  const _logTarget = (event: string) => async (target: any) => {
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

  // browser.on('targetcreated', _logTarget('created'));
  // browser.on('targetdestroyed', _logTarget('destroyed'));
  // browser.on('targetchanged', _logTarget('changed'));

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

  console.log(`\n✅ Browser ready for MCP connection at: http://localhost:${customPort}`);
  console.log(`   WebSocket: ${wsEndpoint}`);
  console.log(`   Profile: ${profileName}`);
  console.log(`   Headless: ${headless}\n`);

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

// Run if executed directly
if (import.meta.url === `file://${__filename}`) {
  parallelLauncherAgent().catch(console.error);
}
