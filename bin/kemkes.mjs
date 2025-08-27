#!/usr/bin/env node
// kemkes.mjs - Node.js script to replace kemkes.cmd
import { spawn } from 'child_process';
import minimist from 'minimist';
import path from 'upath';
import { fileURLToPath } from 'url';
import { installIfNeeded } from './build.mjs';
import chokidar from 'chokidar';
import treeKill from 'tree-kill';
import { spawnAsync } from 'cross-spawn';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CWD = process.cwd();
const BUILD_SCRIPT = path.resolve(__dirname, 'build.mjs');

const COMMANDS = {
  hadir: {
    dev: path.resolve(CWD, 'src/runner/sehatindonesiaku-kehadiran.ts'),
    prod: path.resolve(CWD, 'dist/runner/sehatindonesiaku-kehadiran.js')
  },
  data: {
    dev: path.resolve(CWD, 'src/runner/sehatindonesiaku-data.ts'),
    prod: path.resolve(CWD, 'dist/runner/sehatindonesiaku-data.js')
  },
  run: {
    dev: path.resolve(CWD, 'src/runner/sehatindonesiaku-kemkes.ts'),
    prod: path.resolve(CWD, 'dist/runner/sehatindonesiaku-kemkes.js')
  },
  config: {
    dev: path.resolve(CWD, 'src/runner/sehatindonesiaku-config.ts'),
    prod: path.resolve(CWD, 'dist/runner/sehatindonesiaku-config.js')
  },
  pelayanan: {
    dev: path.resolve(CWD, 'src/runner/sehatindonesiaku-pelayanan.ts'),
    prod: path.resolve(CWD, 'dist/runner/sehatindonesiaku-pelayanan.js')
  },
  default: {
    dev: path.resolve(CWD, 'src/runner/sehatindonesiaku-kemkes.ts'),
    prod: path.resolve(CWD, 'dist/runner/sehatindonesiaku-kemkes.js')
  }
};

const SIGNAL = process.platform === 'win32' ? 'SIGKILL' : 'SIGTERM';

function runAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: 'inherit', shell: true, ...options });
    proc.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${command} exited with code ${code}`))));
    proc.on('error', reject);
  });
}

async function buildIfNeeded() {
  await runAsync('node', [BUILD_SCRIPT]);
}

async function showCommandHelp(name) {
  const script = COMMANDS[name]?.prod;
  if (!script) return;
  const result = await spawnAsync('node', [script, '--help'], { stdio: 'pipe', shell: true });
  console.log(result.output.toString().trim());
}

async function showHelp() {
  console.log(`
Usage: kemkes <command> [options]

Commands:
  hadir         Run kehadiran (attendance) automation
  data          Run data automation
  run           Run main kemkes script
  help          Show this help message

Options:
  -d, --dev         Run in development mode (TypeScript source)
  --development     Same as --dev
  -w, --watch       Watch src/ for changes and rerun command automatically
  --watch           Same as -w
Sub-options:
  -h, --help        Show help (e.g., kemkes data --help)

Examples:
  kemkes --dev --watch hadir
  kemkes data
  kemkes run --help
  kemkes hadir --single
`);

  for (const name of ['config', 'data', 'hadir', 'run', 'pelayanan']) {
    centerLog(`==== ${name.toUpperCase()} Command Help ====`);
    await showCommandHelp(name);
  }
}

function centerLog(msg) {
  const width = process.stdout.columns || 80;
  const pad = Math.max(0, Math.floor((width - msg.length) / 2));
  console.log('\n' + ' '.repeat(pad) + msg + '\n');
}

function getForwardedArgs(cmd, rawArgs, excludeFlags) {
  const idx = rawArgs.indexOf(cmd);
  const args = idx === -1 ? rawArgs : rawArgs.slice(idx + 1);
  return args.filter((a) => !excludeFlags.includes(a));
}

// --- Process management ---
let currentProcess = null;
function killProcess(proc, label = 'process') {
  if (proc?.pid && !proc.killed) {
    console.log(`[watch] Killing ${label} ${proc.pid} with ${SIGNAL}`);
    treeKill(proc.pid, SIGNAL, (err) => {
      if (err) console.error(`[watch] Failed to kill ${label} ${proc.pid}:`, err);
    });
  }
}

async function runCommand(cmd, dev, forwarded, { cancelPrevious = false } = {}) {
  if (cmd === 'help') {
    if (await installIfNeeded()) console.log('Dependencies installed/updated.');
    return showHelp();
  }

  if (cancelPrevious) killProcess(currentProcess);

  const target = COMMANDS[cmd] || COMMANDS.default;
  const script = dev
    ? ['--no-warnings', '--loader', 'ts-node/esm', target.dev, ...forwarded]
    : [target.prod, ...forwarded];

  console.log(`Running ${dev ? 'development' : 'production'} ${cmd}...`);

  await new Promise((resolve, reject) => {
    currentProcess = spawn('node', script, { stdio: 'inherit', shell: true });
    currentProcess.on('exit', (code) => {
      currentProcess = null;
      if (code === 0) {
        resolve(undefined);
      } else {
        reject(new Error(`node exited with code ${code}`));
      }
    });
    currentProcess.on('error', (err) => {
      currentProcess = null;
      reject(err);
    });
  });
}

// --- Main CLI ---
async function main() {
  const argv = minimist(process.argv.slice(2), {
    boolean: ['dev', 'development', 'd', 'watch', 'w'],
    alias: { d: 'dev', w: 'watch' }
  });

  const rawArgs = process.argv.slice(2);
  const args = argv._;
  const dev = argv.dev || argv.development;
  const watch = argv.watch;
  const flags = ['-d', '--dev', '--development', '-w', '--watch'];

  if (!dev) {
    if (await installIfNeeded()) console.log('Dependencies installed/updated.');
    await buildIfNeeded();
  }

  const cmd = args[0] || 'default';
  const forwarded = getForwardedArgs(cmd, rawArgs, flags);

  if (watch) {
    console.log('Watch mode enabled. Watching src/ for changes...');
    const argsWithoutWatch = rawArgs.filter((a) => !['-w', '--watch'].includes(a));
    let child = null,
      restartTimeout = null,
      lastRestart = 0;

    function restartChild() {
      const now = Date.now();
      const delay = Math.max(0, 5000 - (now - lastRestart));
      clearTimeout(restartTimeout);
      restartTimeout = setTimeout(() => {
        killProcess(child, 'child');
        child = spawn(process.execPath, [__filename, ...argsWithoutWatch], { stdio: 'inherit' });
        lastRestart = Date.now();
      }, delay);
    }

    chokidar.watch('src/**/*.{js,ts,cjs,mjs}', { ignoreInitial: true, ignored: [/tmp/i] }).on('all', (event, file) => {
      console.log(`[watch] ${event}: ${file}`);
      restartChild();
    });

    restartChild(); // Initial run
    return;
  }

  await runCommand(cmd, dev, forwarded);
}

main().catch(console.error);
