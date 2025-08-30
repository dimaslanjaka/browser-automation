import color from 'ansi-colors';
import * as unicodeSymbols from 'unicode-symbols';
import logSymbols from 'log-symbols';
import { spawn, spawnSync } from 'child_process';
import fs from 'fs-extra';
import { getChecksum } from 'sbg-utility';
import path from 'upath';

/**
 * Run a command asynchronously using child_process.spawn.
 * @param {string} command - The command to run.
 * @param {string[]} args - The command arguments.
 * @param {object} [options] - Additional spawn options.
 * @returns {Promise<void>} Resolves when the command exits with code 0, rejects otherwise.
 */

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
/**
 * Install dependencies using yarn if needed.
 * Ensures yarn.lock exists and runs yarn install.
 * @returns {Promise<void>}
 */

export async function installDependencies() {
  const yarn = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
  const yarnLockPath = path.join(process.cwd(), 'yarn.lock');
  if (!fs.existsSync(yarnLockPath)) {
    fs.writeFileSync(yarnLockPath, '', 'utf-8'); // Ensure yarn.lock exists only if not present
  }
  await runAsync(yarn, ['install']);
}
/**
 * Installs dependencies if the checksum of .yarnrc.yml or package.json has changed.
 * @returns {Promise<boolean>} True if install was needed and performed, false otherwise.
 */

export async function installIfNeeded() {
  const checksum = getChecksum(path.join(process.cwd(), '.yarnrc.yml'), path.join(process.cwd(), 'package.json'));
  const checksumFile = path.join(process.cwd(), 'tmp/.last_install_checksum');
  const lastChecsum = fs.existsSync(checksumFile) ? fs.readFileSync(checksumFile, 'utf-8') : null;
  if (checksum !== lastChecsum) {
    await installDependencies();
    fs.ensureDirSync(path.dirname(checksumFile));
    fs.writeFileSync(checksumFile, checksum, 'utf-8');
    return true;
  }
  return false;
}
/**
 * Runs the build process if the checksum of package.json or src/ has changed.
 * Updates the checksum file after a successful build.
 * @returns {Promise<void>}
 */

export async function build() {
  const checksumFile = path.join(process.cwd(), 'tmp/.last_bin_build_checksum');
  const lastChecksum = fs.existsSync(checksumFile) ? fs.readFileSync(checksumFile, 'utf-8').trim() : null;
  const checksum = getChecksum(path.join(process.cwd(), 'package.json'), path.join(process.cwd(), 'src'));

  if (lastChecksum !== checksum) {
    console.log(
      [
        `${logSymbols.info} ${color.cyan('Checksum changed, running build...')}`,
        ` ${unicodeSymbols.arrowLeft} Previous: ${color.yellow(lastChecksum)}`,
        ` ${unicodeSymbols.arrowDown} Current:  ${color.green(checksum)}`
      ].join('\n')
    );
    // Run the build command with shell:true to ensure all output is shown
    const result = spawnSync('npm', ['run', 'build'], { stdio: 'inherit', shell: true });
    console.log(`Build process exited with code: ${result.status}`);
    if (result.error) {
      console.error('Error running build:', result.error);
    }
    if (result.status !== 0) {
      process.exit(result.status);
    }
    // Update the checksum file
    fs.writeFileSync(checksumFile, checksum);
  } else {
    console.log(
      [
        `${logSymbols.success} ${color.green('No changes detected, skipping build.')}`,
        ` ${unicodeSymbols.arrowLeft} Previous: ${color.yellow(lastChecksum)}`,
        ` ${unicodeSymbols.arrowDown} Current:  ${color.green(checksum)}`
      ].join('\n')
    );
  }
}

if (process.argv.some((arg) => arg.includes('build.mjs'))) {
  (async () => {
    await installIfNeeded();
    await build();
  })();
}
