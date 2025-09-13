import { spawnAsync } from 'cross-spawn';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateDataDisplay() {
  const lockFile = path.join(__dirname, 'tmp/sehatindonesiaku-data-display.lock');
  // Skip if lock file exists (another process is running)
  if (fs.existsSync(lockFile)) {
    console.log('Data generation already in progress, skipping...');
    return;
  }
  // Create lock file to indicate process is running
  fs.ensureDirSync(path.dirname(lockFile));
  fs.writeFileSync(lockFile, 'lock');
  try {
    const scriptPath = path.resolve(__dirname, '../src/runner/sehatindonesiaku-data-display.ts');
    await spawnAsync('node', ['--no-warnings=ExperimentalWarning', '--loader', 'ts-node/esm', scriptPath], {
      stdio: 'inherit'
    });
  } catch (error) {
    console.error('Execution failed:', error);
    throw error;
  } finally {
    // Remove lock file after a delay to allow subsequent runs
    setTimeout(() => {
      if (fs.existsSync(lockFile)) {
        fs.removeSync(lockFile);
      }
    }, 5000); // 5 seconds delay
  }
}

export default function PrepareVitePlugin() {
  return {
    name: 'prepare-vite-plugin',
    options(options) {
      // Run data generation before Vite processes any options or files
      console.log('Generating required JSON data before Vite build...');
      generateDataDisplay(); // Run in background, not awaited
      console.log('Required JSON data generated.');
      return options;
    }
  };
}

if (process.argv.some((arg) => arg.includes('prepare-vite-plugin'))) {
  generateDataDisplay();
}
