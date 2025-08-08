import pkg from './package.json' with { type: 'json' };
import color from 'ansi-colors';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function processDependencies(dependencies, label) {
  for (const key in dependencies) {
    const version = dependencies[key];
    if (/^(file:|https?:)/.test(version)) {
      continue;
    }
    const resetVersion = '^0';
    console.log(color.magenta(`[${label}]`), color.yellow(key), color.cyan(version), '→', color.green(resetVersion));
    dependencies[key] = resetVersion;
  }
}

processDependencies(pkg.dependencies, 'dep');
processDependencies(pkg.devDependencies, 'dev');

// Write the modified package.json back to disk
fs.writeFileSync('./package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log(color.green('✓'), 'package.json updated successfully');

// Run npm-check-updates to update dependencies
console.log(color.blue('ℹ'), 'Running npm-check-updates...');

const child = spawn('yarn', ['dlx', 'npm-check-updates', '-u', '--enginesNode'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true
});

child.on('close', (code) => {
  if (code === 0) {
    console.log(color.green('✓'), 'npm-check-updates completed successfully');
  } else {
    console.error(color.red('✗'), `npm-check-updates exited with code ${code}`);
    process.exit(code);
  }
});

child.on('error', (error) => {
  console.error(color.red('✗'), 'Error running npm-check-updates:', error.message);
  process.exit(1);
});
