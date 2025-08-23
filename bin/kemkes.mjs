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

function run(command, args, options = {}) {
  const proc = spawn(command, args, { stdio: 'inherit', shell: true, ...options });
  proc.on('exit', (code) => process.exit(code));
}

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

function buildIfNeeded() {
  const srcDir = path.join(CWD, 'src');
  const packageJson = path.join(CWD, 'package.json');

  const checksum = getChecksum(srcDir, packageJson, __filename);
  const checksumFile = path.join(process.cwd(), 'tmp/.last_build_checksum');
  const lastChecksum = fs.existsSync(checksumFile) ? fs.readFileSync(checksumFile, 'utf-8') : null;

  if (checksum !== lastChecksum) {
    run('yarn', ['build']);
    fs.ensureDirSync(path.dirname(checksumFile));
    fs.writeFileSync(checksumFile, checksum, 'utf-8');
    return true;
  }
  return false;
}

async function main() {
  const argv = minimist(process.argv.slice(2), {
    boolean: ['dev', 'development', 'd'],
    alias: { d: 'dev' }
  });
  const args = process.argv.slice(2);
  const dev = argv.dev || argv.development;

  if (!dev) {
    const needInstall = await installIfNeeded();
    if (needInstall) {
      console.log('Dependencies installed/updated.');
    }
    buildIfNeeded();
  }

  // Check for 'hadir' as the first argument
  if (args[0] === 'hadir') {
    // Remove all dev flags from hadirArgs for the script
    const hadirArgs = args.slice(1).filter((a) => a !== '-d' && a !== '--dev' && a !== '--development');
    if (dev) {
      console.log('Running development hadir (TypeScript source)...');
      run('node', [
        '--no-warnings',
        '--loader',
        'ts-node/esm',
        path.resolve(CWD, 'src/runner/sehatindonesiaku-kehadiran.ts'),
        ...hadirArgs
      ]);
    } else {
      console.log('Running production hadir...');
      run('node', [path.resolve(CWD, 'dist/runner/sehatindonesiaku-kehadiran.js'), ...hadirArgs]);
    }
    return;
  }

  if (dev) {
    console.log('Running development build (TypeScript source)...');
    // Remove all dev flags from args for the script
    const devArgs = args.filter((a) => a !== '-d' && a !== '--dev' && a !== '--development');
    run('node', [
      '--no-warnings',
      '--loader',
      'ts-node/esm',
      path.resolve(CWD, 'src/runner/sehatindonesiaku-kemkes.ts'),
      ...devArgs
    ]);
    return;
  }

  console.log('Running production build...');
  run('node', [BUILD_SCRIPT]);
  run('node', [path.resolve(CWD, 'dist/runner/sehatindonesiaku-kemkes.js'), ...args]);
}

main().catch(console.error);
