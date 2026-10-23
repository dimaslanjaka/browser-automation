import { spawnAsync } from 'cross-spawn';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function generateDataDisplay(force = false) {
  // Data generation logic removed
  return;
}

/**
 * Vite plugin to run data generation before build.
 * Ensures required JSON data is generated before Vite processes files.
 *
 * @returns {import('vite').Plugin} Vite plugin object
 */
export default function PrepareVitePlugin() {
  let isBuild = false;
  return {
    name: 'prepare-vite-plugin',
    configResolved(config) {
      isBuild = config.command === 'build';
    },
    async options(options) {
      if (isBuild) {
        // Run data generation before Vite processes any options or files
        console.log('Generating required JSON data before Vite build...');
        await generateDataDisplay().then(() => {
          console.log('Required JSON data generated.');
        });
      }
      return options;
    }
  };
}

if (process.argv.some((arg) => /prepare-vite-plugin\.(js|ts)$/.test(arg))) {
  generateDataDisplay(true);
}
