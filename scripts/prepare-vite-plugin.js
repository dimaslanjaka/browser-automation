import { promisify } from 'util';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function generateDataDisplay() {
  const execAsync = promisify(exec);

  try {
    const scriptPath = resolve(__dirname, '../src/runner/sehatindonesiaku-data-display.ts');
    const { stdout, stderr } = await execAsync(
      `node --no-warnings=ExperimentalWarning --loader ts-node/esm "${scriptPath}"`
    );
    if (stderr) {
      console.error('Error:', stderr);
    }
    console.log('Output:', stdout);
  } catch (error) {
    console.error('Execution failed:', error);
    throw error;
  }
}

export default function PrepareVitePlugin() {
  return {
    name: 'prepare-vite-plugin',
    async options(options) {
      // Run data generation before Vite processes any options or files
      console.log('Generating required JSON data before Vite build...');
      await generateDataDisplay();
      console.log('Required JSON data generated.');
      return options;
    }
  };
}

if (process.argv.some((arg) => arg.includes('prepare-vite-plugin'))) {
  generateDataDisplay();
}
