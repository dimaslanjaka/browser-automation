import 'dotenv/config';
import { execFileSync } from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.join(__dirname, 'dist');
const branch = 'gh-pages';
const user = { name: 'dimaslanjaka', email: 'dimaslanjaka@gmail.com' };

function runGit(args, cwd) {
  execFileSync('git', args, { cwd, stdio: 'inherit' });
}

function getGitOutput(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function runGitAllowFailure(args, cwd) {
  try {
    execFileSync('git', args, { cwd, stdio: 'inherit' });
    return 0;
  } catch (error) {
    return error?.status ?? 1;
  }
}

function applyStashPreferringOurs(cwd) {
  const status = runGitAllowFailure(['stash', 'pop'], cwd);
  if (status === 0) {
    return;
  }

  const conflictPaths = getGitOutput(['diff', '--name-only', '--diff-filter=U'], cwd).split(/\r?\n/).filter(Boolean);

  for (const filePath of conflictPaths) {
    runGit(['checkout', '--ours', '--', filePath], cwd);
    runGit(['add', '--', filePath], cwd);
  }

  runGit(['stash', 'drop'], cwd);
}

function deploy() {
  if (!fs.existsSync(distDir)) {
    throw new Error(`Missing build output: ${distDir}`);
  }

  const repoUrl = getGitOutput(['remote', 'get-url', 'origin'], __dirname);
  const hasRemoteBranch = getGitOutput(['ls-remote', '--heads', repoUrl, branch], __dirname).length > 0;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'browser-automation-gh-pages-'));

  try {
    if (hasRemoteBranch) {
      runGit(['clone', '--depth', '1', '--branch', branch, '--single-branch', repoUrl, tempDir], __dirname);
    } else {
      fs.mkdirSync(tempDir, { recursive: true });
      runGit(['init'], tempDir);
      runGit(['checkout', '--orphan', branch], tempDir);
      runGit(['remote', 'add', 'origin', repoUrl], tempDir);
    }

    runGit(['config', 'user.email', user.email], tempDir);
    runGit(['config', 'user.name', user.name], tempDir);

    fs.copySync(distDir, tempDir, {
      overwrite: true,
      dereference: true
    });

    fs.writeFileSync(path.join(tempDir, '.nojekyll'), '');

    runGit(['add', '-A'], tempDir);
    runGit(['stash', 'push', '-u', '-m', 'deploy-worktree'], tempDir);
    runGit(['pull', '--ff-only', 'origin', branch], tempDir);
    applyStashPreferringOurs(tempDir);

    const status = getGitOutput(['status', '--porcelain'], tempDir);
    if (!status) {
      console.log('No deployment changes detected.');
      return;
    }

    runGit(['commit', '-m', `Deploying to GitHub Pages: ${new Date().toISOString()}`], tempDir);
    runGit(['push', '--set-upstream', 'origin', branch], tempDir);
  } finally {
    fs.removeSync(tempDir);
  }
}

try {
  deploy();

  console.log('Deployment successful!');
} catch (err) {
  console.error('Error during deployment:', err);
}

// Clean up .git from dist after deployment
const distGitDir = path.join(distDir, '.git');
if (fs.existsSync(distGitDir)) {
  fs.removeSync(distGitDir);
}
