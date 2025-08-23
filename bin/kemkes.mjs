#!/usr/bin/env node
// kemkes.mjs - Node.js script to replace kemkes.cmd
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'upath';
import minimist from 'minimist';
import { getChecksum } from 'sbg-utility';
import fs from 'fs-extra';

// Polyfill for __filename and __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CWD = process.cwd();
const BUILD_SCRIPT = path.resolve(__dirname, 'build.mjs');

function runAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: 'inherit', shell: true, ...options });
    proc.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
    proc.on('error', reject);
  });
}

async function installDependencies() {
  const yarn = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
  const yarnLockPath = path.join(CWD, 'yarn.lock');
  if (!fs.existsSync(yarnLockPath)) {
    fs.writeFileSync(yarnLockPath, '', 'utf-8'); // Ensure yarn.lock exists only if not present
  }
  await runAsync(yarn, ['install']);
}

async function installIfNeeded() {
  const checksum = getChecksum(path.join(CWD, 'src'), path.join(CWD, 'package.json'), __filename);
  const checksumFile = path.join(CWD, 'tmp/.last_install_checksum');
  const lastChecsum = fs.existsSync(checksumFile) ? fs.readFileSync(checksumFile, 'utf-8') : null;
  if (checksum !== lastChecsum) {
    await installDependencies();
    fs.ensureDirSync(path.dirname(checksumFile));
    fs.writeFileSync(checksumFile, checksum, 'utf-8');
    return true;
  }
  return false;
}

async function buildIfNeeded() {
  const srcDir = path.join(CWD, 'src');
  const packageJson = path.join(CWD, 'package.json');

  const checksum = getChecksum(srcDir, packageJson, __filename);
  const checksumFile = path.join(process.cwd(), 'tmp/.last_build_checksum');
  const lastChecksum = fs.existsSync(checksumFile) ? fs.readFileSync(checksumFile, 'utf-8') : null;

  if (checksum !== lastChecksum) {
    await runAsync('yarn', ['build']);
    fs.ensureDirSync(path.dirname(checksumFile));
    fs.writeFileSync(checksumFile, checksum, 'utf-8');
    return true;
  }
  return false;
}

async function main() {
  const argv = minimist(process.argv.slice(2), {
    boolean: ['dev', 'development', 'd', 'help', 'h'],
    alias: { d: 'dev', h: 'help' }
  });
  const args = argv._;
  const dev = argv.dev || argv.development;
  const help = argv.help;
  const devFlags = ['-d', '--dev', '--development'];
  const helpFlags = ['-h', '--help'];
  const filterDevFlags = (arr) => arr.filter((a) => !devFlags.includes(a) && !helpFlags.includes(a));

  if (help || args[0] === 'help' || args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: kemkes [options] <command> [args...]

Options:
  -d, --dev           Run in development mode (TypeScript source)
  -h, --help          Show this help message

Commands:
  hadir [args...]     Run the 'hadir' subcommand
  data [args...]      Run the 'data' subcommand
  (no command)        Run the main kemkes runner

Examples:
  kemkes hadir --dev
  kemkes data -d
  kemkes --help
`);
    return;
  }

  if (!dev) {
    const needInstall = await installIfNeeded();
    if (needInstall) {
      console.log('Dependencies installed/updated.');
    }
    await buildIfNeeded();
  }

  // Handle subcommands
  if (args[0] === 'hadir') {
    const hadirArgs = filterDevFlags(args.slice(1));
    const script = dev
      ? [
          '--no-warnings',
          '--loader',
          'ts-node/esm',
          path.resolve(CWD, 'src/runner/sehatindonesiaku-kehadiran.ts'),
          ...hadirArgs
        ]
      : [path.resolve(CWD, 'dist/runner/sehatindonesiaku-kehadiran.js'), ...hadirArgs];
    console.log(`Running ${dev ? 'development' : 'production'} hadir...`);
    await runAsync('node', script);
    return;
  } else if (args[0] === 'data') {
    const dataArgs = filterDevFlags(args.slice(1));
    const script = dev
      ? [
          '--no-warnings',
          '--loader',
          'ts-node/esm',
          path.resolve(CWD, 'src/runner/sehatindonesiaku-data.ts'),
          ...dataArgs
        ]
      : [path.resolve(CWD, 'dist/runner/sehatindonesiaku-data.js'), ...dataArgs];
    console.log(`Running ${dev ? 'development' : 'production'} data...`);
    await runAsync('node', script);
    return;
  }

  const devArgs = filterDevFlags(args);
  if (dev) {
    console.log('Running development build (TypeScript source)...');
    await runAsync('node', [
      '--no-warnings',
      '--loader',
      'ts-node/esm',
      path.resolve(CWD, 'src/runner/sehatindonesiaku-kemkes.ts'),
      ...devArgs
    ]);
    return;
  }

  console.log('Running production build...');
  await runAsync('node', [BUILD_SCRIPT]);
  await runAsync('node', [path.resolve(CWD, 'dist/runner/sehatindonesiaku-kemkes.js'), ...devArgs]);
}

main().catch(console.error);
