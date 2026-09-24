'use strict';

var require$$0 = require('child_process');
var fs = require('fs-extra');
var puppeteerRealBrowser = require('puppeteer-real-browser');
var require$$4 = require('sbg-utility');
var path = require('upath');
var url = require('url');
var puppeteer_parallel_EndpointManager = require('../../../puppeteer/parallel/EndpointManager.cjs');
var profileManager = require('../profile-manager.cjs');

var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
const __dirname$1 = path.dirname(url.fileURLToPath((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('src/puppeteer/parallel/utils.cjs', document.baseURI).href))));
const launcherLogPath = path.join(profileManager.GLOBAL_PUPPETEER_DIR, 'launcher.log');
const launchTimeoutMs = 60_000;
const endpointManager = new puppeteer_parallel_EndpointManager.EndpointManager();
/**
 * Check whether a process with the given PID is currently running.
 *
 * Uses `process.kill(pid, 0)` which does not terminate the process but
 * will throw if the process does not exist or the caller lacks permission.
 *
 * @param pid - Process id to check
 * @returns `true` if the process appears to be running, otherwise `false`
 */
function isProcessRunning(pid) {
    try {
        process.kill(pid, 0);
        return true;
    }
    catch {
        return false;
    }
}
/**
 * Spawns a detached child process that runs the Puppeteer launcher
 * (`launcher.runner.ts` or its compiled `.js` counterpart).
 *
 * Waits up to 60 seconds for a running-indicator file to appear under
 * `GLOBAL_PUPPETEER_DIR`. Throws if the child exits prematurely or the
 * timeout is exceeded.
 *
 * @returns A promise that resolves once the browser process signals it is ready
 */
async function launch() {
    const cwd = process.cwd();
    const jsLauncherPath = path.join(__dirname$1, 'launcher.runner.js');
    const tsLauncherPath = path.join(__dirname$1, 'launcher.runner.ts');
    const hasJsLauncher = fs.existsSync(jsLauncherPath);
    const launcherPath = hasJsLauncher ? jsLauncherPath : tsLauncherPath;
    const args = hasJsLauncher
        ? [launcherPath]
        : ['--no-warnings=ExperimentalWarning', '--loader', 'ts-node/esm', launcherPath];
    fs.ensureDirSync(profileManager.GLOBAL_PUPPETEER_DIR);
    const logFd = fs.openSync(launcherLogPath, 'a');
    const child = require$$0.spawn(process.execPath, args, {
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
    const runningIndicatorPath = path.join(profileManager.GLOBAL_PUPPETEER_DIR, 'browser-running', pid.toString());
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
            throw new Error(`Timed out waiting ${Math.round(launchTimeoutMs / 1000)}s for browser process (PID: ${pid}) to initialize. Check log: ${launcherLogPath}`);
        }
        const elapsedSeconds = ((Date.now() - waitStart) / 1000).toFixed(1);
        process.stdout.write(`\rLaunching browser process with PID: ${pid}, waiting for it to initialize... (${elapsedSeconds}s elapsed)`);
        await require$$4.delay(100);
    }
    process.stdout.write('\n');
    console.log(`Browser process with PID: ${pid} is ready.`);
}
/**
 * Connects to an available Puppeteer browser endpoint.
 *
 * Queries the {@link endpointManager} for active endpoints. If none exist, or
 * no free endpoint can be claimed, a new browser is launched automatically via
 * {@link launch}.
 *
 * The function loops until it can claim an unlocked, Puppeteer-responsive
 * endpoint. Dead endpoints (`ECONNREFUSED`) are removed from the registry
 * transparently. Once a connection is established a `disconnected` listener
 * releases the claim.
 *
 * @returns A promise that resolves with a connected {@link Browser} instance
 * @throws If no endpoint can be obtained after repeated launch attempts
 */
async function connect() {
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
            const { browser } = await puppeteerRealBrowser.connect({
                connectOption: { browserWSEndpoint: endpoint, protocolTimeout: 180_000 }
            });
            browser.once('disconnected', () => {
                endpointManager.releaseEndpointClaim(endpoint, ownerPid);
            });
            console.log('Successfully connected to browser with endpoint:', browser.wsEndpoint());
            return browser;
        }
        catch (error) {
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

exports.connect = connect;
exports.endpointManager = endpointManager;
exports.launch = launch;
