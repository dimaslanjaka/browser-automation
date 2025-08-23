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
  const checksum = getChecksum(path.join(CWD, 'src'), path.join(CWD, 'package.json'));
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
  await runAsync('node', [BUILD_SCRIPT]);
}

async function main() {
  const argv = minimist(process.argv.slice(2), {
    boolean: ['dev', 'development', 'd'],
    alias: { d: 'dev' }
  });
  // Use process.argv.slice(2) directly for forwarding, so all flags are preserved
  const rawArgs = process.argv.slice(2);
  const args = argv._;
  const dev = argv.dev || argv.development;
  const devFlags = ['-d', '--dev', '--development'];

  if (!dev) {
    const needInstall = await installIfNeeded();
    if (needInstall) {
      console.log('Dependencies installed/updated.');
    }
    await buildIfNeeded();
  }

  // Handle subcommands
  if (args[0] === 'help') {
    console.log();
    console.log('Usage: kemkes <command> [options]');
    console.log();
    console.log('Commands:');
    console.log('  hadir         Run kehadiran (attendance) automation');
    console.log('  data          Run data automation');
    console.log('  help          Show this help message');
    console.log();
    console.log('Options:');
    console.log('  -d, --dev     Run in development mode (TypeScript source)');
    console.log('  --development Same as --dev');
    console.log('  -h, --help    Show help');
    console.log();
    console.log('Examples:');
    console.log('  kemkes hadir --dev');
    console.log('  kemkes data');
    console.log();
    return;
  } else if (args[0] === 'hadir') {
    // Forward all non-dev flags as-is from the original argv
    const hadirArgIndex = rawArgs.findIndex((a) => a === 'hadir');
    const forwarded = rawArgs.slice(hadirArgIndex + 1).filter((a) => !devFlags.includes(a));
    const script = dev
      ? [
          '--no-warnings',
          '--loader',
          'ts-node/esm',
          path.resolve(CWD, 'src/runner/sehatindonesiaku-kehadiran.ts'),
          ...forwarded
        ]
      : [path.resolve(CWD, 'dist/runner/sehatindonesiaku-kehadiran.js'), ...forwarded];
    console.log(`Running ${dev ? 'development' : 'production'} hadir...`);
    await runAsync('node', script);
    return;
  } else if (args[0] === 'data') {
    // Forward all non-dev flags as-is from the original argv
    const dataArgIndex = rawArgs.findIndex((a) => a === 'data');
    const forwarded = rawArgs.slice(dataArgIndex + 1).filter((a) => !devFlags.includes(a));
    const script = dev
      ? [
          '--no-warnings',
          '--loader',
          'ts-node/esm',
          path.resolve(CWD, 'src/runner/sehatindonesiaku-data.ts'),
          ...forwarded
        ]
      : [path.resolve(CWD, 'dist/runner/sehatindonesiaku-data.js'), ...forwarded];
    console.log(`Running ${dev ? 'development' : 'production'} data...`);
    await runAsync('node', script);
    return;
  } else if (args[0] === 'run') {
    // Run main script with all args after 'run'
    const runArgIndex = rawArgs.findIndex((a) => a === 'run');
    const forwarded = rawArgs.slice(runArgIndex + 1).filter((a) => !devFlags.includes(a));
    console.log('Running kemkes (main) script with forwarded args...');
    await runAsync(
      'node',
      dev
        ? [
            '--no-warnings',
            '--loader',
            'ts-node/esm',
            path.resolve(CWD, 'src/runner/sehatindonesiaku-kemkes.ts'),
            ...forwarded
          ]
        : [path.resolve(CWD, 'dist/runner/sehatindonesiaku-kemkes.js'), ...forwarded]
    );
    return;
  }

  // Default to running kemkes (main) script
  const devArgs = rawArgs.filter((a) => !devFlags.includes(a));
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
  await runAsync('node', [path.resolve(CWD, 'dist/runner/sehatindonesiaku-kemkes.js'), ...devArgs]);
}

main().catch(console.error);
