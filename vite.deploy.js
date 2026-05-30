import 'dotenv/config';
import { execFileSync } from 'child_process';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { globSync } from 'glob';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const deployDir = path.join(__dirname, '.deploy_git');
const distDir = path.join(__dirname, 'dist');
const branch = 'gh-pages';
const user = { name: 'dimaslanjaka', email: 'dimaslanjaka@gmail.com' };

function git(args, cwd) {
  execFileSync('git', args, { cwd, stdio: 'inherit' });
}

function gitOutput(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function deploy() {
  if (!fs.existsSync(distDir)) {
    throw new Error(`Missing build output: ${distDir}`);
  }

  const repoUrl = gitOutput(['remote', 'get-url', 'origin'], __dirname);

  // --- ensure .deploy_git exists and is on the right branch ---
  if (fs.existsSync(deployDir)) {
    git(['reset', '--hard', `origin/${branch}`], deployDir);
  } else {
    git(['clone', '--depth', '1', '--branch', branch, '--single-branch', repoUrl, deployDir], __dirname);
  }

  git(['config', 'user.email', user.email], deployDir);
  git(['config', 'user.name', user.name], deployDir);

  // --- clean old deploy artifacts ---
  const screenshotsDir = path.join(deployDir, 'assets', 'data', 'screenshots');
  if (fs.existsSync(screenshotsDir)) {
    fs.removeSync(screenshotsDir);
  }

  const assetsDir = path.join(deployDir, 'assets');
  if (fs.existsSync(assetsDir)) {
    for (const f of globSync('*.{js,css}', { cwd: assetsDir })) {
      fs.removeSync(path.join(assetsDir, f));
    }
  }

  // --- copy new build ---
  fs.copySync(distDir, deployDir, { overwrite: true, dereference: true });
  fs.writeFileSync(path.join(deployDir, '.nojekyll'), '');

  // --- commit and push ---
  git(['add', '-A'], deployDir);

  const status = gitOutput(['status', '--porcelain'], deployDir);
  if (!status) {
    console.log('No deployment changes detected.');
    return;
  }

  git(['commit', '-m', `Deploying to GitHub Pages: ${new Date().toISOString()}`], deployDir);
  git(['push', '--set-upstream', 'origin', branch], deployDir);
}

try {
  deploy();
  console.log('Deployment successful!');
} catch (err) {
  console.error('Error during deployment:', err);
}
