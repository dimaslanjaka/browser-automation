import color from 'ansi-colors';
import { spawn, spawnSync } from 'child_process';
import fs from 'fs-extra';
import path from 'upath';
import { getChecksum } from 'sbg-utility';

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

export async function installDependencies() {
  const yarn = process.platform === 'win32' ? 'yarn.cmd' : 'yarn';
  const yarnLockPath = path.join(process.cwd(), 'yarn.lock');
  if (!fs.existsSync(yarnLockPath)) {
    fs.writeFileSync(yarnLockPath, '', 'utf-8'); // Ensure yarn.lock exists only if not present
  }
  await runAsync(yarn, ['install']);
}

export async function installIfNeeded() {
  const checksum = getChecksum(path.join(process.cwd(), 'src'), path.join(process.cwd(), 'package.json'));
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

export async function build() {
  const checksumFile = path.join(process.cwd(), 'tmp/.last_bin_build_checksum');
  const lastChecksum = fs.existsSync(checksumFile) ? fs.readFileSync(checksumFile, 'utf-8').trim() : null;
  const checksum = getChecksum(path.join(process.cwd(), 'package.json'), path.join(process.cwd(), 'src'));

  if (lastChecksum !== checksum) {
    console.log(
      [
        'Checksum changed, running build...',
        `  Previous: ${color.yellow(lastChecksum)}`,
        `  Current:  ${color.green(checksum)}`
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
        'No changes detected, skipping build.',
        `  Previous: ${color.yellow(lastChecksum)}`,
        `  Current:  ${color.green(checksum)}`
      ].join('\n')
    );
  }
}

if (process.argv.some((arg) => arg.includes('build.mjs'))) {
  (async () => {
    await build();
  })();
}
