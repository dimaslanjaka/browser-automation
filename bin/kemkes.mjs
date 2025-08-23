#!/usr/bin/env node
// kemkes.mjs - Node.js script to replace kemkes.cmd
import { spawn } from 'child_process';
import minimist from 'minimist';
import path from 'upath';
import { fileURLToPath } from 'url';
import { installIfNeeded } from './build.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CWD = process.cwd();
const BUILD_SCRIPT = path.resolve(__dirname, 'build.mjs');

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

function showHelp() {
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
Sub-options:
  -h, --help        Show help (e.g., kemkes data --help)

Examples:
  kemkes hadir --dev
  kemkes data
`);
}

function getForwardedArgs(cmd, rawArgs, devFlags) {
  const idx = rawArgs.indexOf(cmd);
  return idx === -1
    ? rawArgs.filter((a) => !devFlags.includes(a))
    : rawArgs.slice(idx + 1).filter((a) => !devFlags.includes(a));
}

async function runCommand(cmd, dev, forwarded) {
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
    default: {
      dev: path.resolve(CWD, 'src/runner/sehatindonesiaku-kemkes.ts'),
      prod: path.resolve(CWD, 'dist/runner/sehatindonesiaku-kemkes.js')
    }
  };

  if (cmd === 'help') {
    showHelp();
    return;
  }

  const target = COMMANDS[cmd] || COMMANDS.default;
  const script = dev
    ? ['--no-warnings', '--loader', 'ts-node/esm', target.dev, ...forwarded]
    : [target.prod, ...forwarded];

  console.log(`Running ${dev ? 'development' : 'production'} ${cmd}...`);
  await runAsync('node', script);
}

async function main() {
  const argv = minimist(process.argv.slice(2), {
    boolean: ['dev', 'development', 'd'],
    alias: { d: 'dev' }
  });

  const rawArgs = process.argv.slice(2);
  const args = argv._;
  const dev = argv.dev || argv.development;
  const devFlags = ['-d', '--dev', '--development'];

  if (!dev) {
    if (await installIfNeeded()) console.log('Dependencies installed/updated.');
    await buildIfNeeded();
  }

  const cmd = args[0] || 'default';
  const forwarded = getForwardedArgs(cmd, rawArgs, devFlags);

  await runCommand(cmd, dev, forwarded);
}

main().catch(console.error);
