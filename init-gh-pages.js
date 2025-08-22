import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Initialize git repository in public/ folder and set up gh-pages branch
 */
function initGitRepository() {
  const publicDir = path.join(__dirname, 'public');

  // Ensure public directory exists
  if (!fs.existsSync(publicDir)) {
    console.log('Creating public directory...');
    fs.mkdirSync(publicDir, { recursive: true });
  }

  console.log(`Working in directory: ${publicDir}`);

  try {
    // Change to public directory
    process.chdir(publicDir);

    // Initialize git repository
    console.log('Initializing git repository...');
    execSync('git init', { stdio: 'inherit' });

    // Set remote origin
    console.log('Setting remote origin...');
    try {
      execSync('git remote add origin https://github.com/dimaslanjaka/browser-automation.git', { stdio: 'inherit' });
    } catch {
      // If remote already exists, update it
      console.log('Remote origin already exists, updating...');
      execSync('git remote set-url origin https://github.com/dimaslanjaka/browser-automation.git', {
        stdio: 'inherit'
      });
    }

    // Set branch to gh-pages
    console.log('Setting branch to gh-pages...');
    execSync('git checkout -B gh-pages', { stdio: 'inherit' });

    // Fetch all branches
    console.log('Fetching all branches...');
    execSync('git fetch --all', { stdio: 'inherit' });

    // Stash any local changes before reset
    console.log('Stashing local changes...');
    try {
      execSync('git stash', { stdio: 'inherit' });
    } catch {
      console.log('No local changes to stash or stash failed, continuing...');
    }

    // Reset to origin/gh-pages
    console.log('Resetting to origin/gh-pages...');
    try {
      execSync('git reset --hard origin/gh-pages', { stdio: 'inherit' });
    } catch {
      console.warn('Warning: Could not reset to origin/gh-pages. Branch might not exist on remote yet.');
      console.warn('This is normal for a new gh-pages branch.');
    }

    // Restore stashed changes and enforce them
    console.log('Restoring stashed changes...');
    try {
      execSync('git stash pop', { stdio: 'inherit' });
      console.log('Local changes restored and enforced over remote changes.');
    } catch {
      console.log('No stashed changes to restore or stash pop failed, continuing...');
    }

    console.log('✅ Git repository setup completed successfully!');
    console.log('Current directory:', process.cwd());

    // Show git status
    console.log('\nGit status:');
    execSync('git status', { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ Error during git setup:', error.message);
    process.exit(1);
  }
}

// Run the function if this script is executed directly
if (
  process.argv[1] &&
  import.meta.url ===
    `file:///${process.argv[1].replace(/\\/g, '/').replace(/^[A-Z]:/, (match) => match.toLowerCase())}`
) {
  initGitRepository();
}

export { initGitRepository };
