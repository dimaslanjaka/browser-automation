#!/usr/bin/env node

import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const parallelScript = path.join(repoRoot, 'bin', 'parallel.py');

/**
 * Resolve a runner command to its source or built mode configuration.
 * @param {string} command - The subcommand name (launch, skrin, skrin-check, check).
 * @returns {{mode: string, input: string, output: string|null}|null} Runner config or null if unknown.
 */
function resolveRunner(command) {
  const sourceMap = {
    launch: {
      input: path.join(repoRoot, 'src', 'puppeteer', 'parallel', 'launcher.runner.ts'),
      output: path.join(repoRoot, 'dist', 'parallel', 'launcher.cjs')
    },
    skrin: {
      input: path.join(repoRoot, 'src', 'puppeteer', 'parallel', 'skrin.runner.ts'),
      output: path.join(repoRoot, 'dist', 'parallel', 'skrin.cjs')
    },
    'skrin-check': {
      input: path.join(repoRoot, 'src', 'puppeteer', 'parallel', 'skrin-check-data.runner.ts'),
      output: path.join(repoRoot, 'dist', 'parallel', 'skrin-check-data.cjs')
    },
    check: {
      input: path.join(repoRoot, 'src', 'puppeteer', 'parallel', 'check.runner.ts'),
      output: null
    }
  };

  const source = sourceMap[command];
  if (!source) {
    return null;
  }

  if (fs.existsSync(source.input)) {
    return {
      mode: 'source',
      ...source
    };
  }

  const builtMap = {
    launch: {
      input: path.join(repoRoot, 'lib', 'puppeteer', 'parallel', 'launcher.runner.mjs'),
      output: path.join(repoRoot, 'lib', 'puppeteer', 'parallel', 'launcher.mjs')
    },
    skrin: {
      input: path.join(repoRoot, 'lib', 'puppeteer', 'parallel', 'skrin.runner.mjs'),
      output: path.join(repoRoot, 'lib', 'puppeteer', 'parallel', 'skrin.mjs')
    },
    'skrin-check': {
      input: path.join(repoRoot, 'lib', 'puppeteer', 'parallel', 'skrin-check-data.runner.mjs'),
      output: path.join(repoRoot, 'lib', 'puppeteer', 'parallel', 'skrin-check-data.mjs')
    },
    check: {
      input: path.join(repoRoot, 'lib', 'puppeteer', 'parallel', 'check.runner.mjs'),
      output: null
    }
  };

  const built = builtMap[command];
  if (!built || !fs.existsSync(built.input)) {
    return null;
  }

  return {
    mode: 'built',
    ...built
  };
}

/**
 * Check if a command-line tool is available on the system.
 * @param {string} command - The command name to check.
 * @param {string[]} [args=['--version']] - Arguments to test the command.
 * @returns {boolean} Whether the command is available.
 */
function hasCommand(command, args = ['--version']) {
  const result = spawnSync(command, args, {
    stdio: 'ignore',
    shell: false
  });
  return !result.error;
}

/**
 * Try to run a command via the Python parallel script when source files are present.
 * @param {string[]} args - CLI arguments.
 * @returns {number|null} The exit code if Python ran, or null to fall back to JS bundling.
 */
function runParallelPython(args) {
  const command = String(args[0] || '').toLowerCase();
  const runner = resolveRunner(command);

  if (!runner || runner.mode !== 'source') {
    return null;
  }

  const candidates = process.platform === 'win32' ? [['python'], ['python3'], ['py', '-3']] : [['python'], ['python3']];

  for (const candidate of candidates) {
    const [command, ...commandArgs] = candidate;
    if (!hasCommand(command, commandArgs.length > 0 ? commandArgs : ['--version'])) {
      continue;
    }

    const result = spawnSync(command, [parallelScript, ...args], {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: false
    });

    if (!result.error) {
      return result.status ?? 0;
    }
  }

  return null;
}

/**
 * Build (if needed) and run a bundled JS command via Node, with rollup for source mode.
 * @param {string} command - The subcommand name.
 * @param {string[]} args - Remaining arguments to forward.
 */
function runBundledCommand(command, args) {
  const bundle = resolveRunner(command);
  if (!bundle) {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }

  if (bundle.mode === 'source') {
    process.env.BUNDLE_INPUT = bundle.input;
    process.env.BUNDLE_OUTPUT = bundle.output;

    const rollupCommand =
      process.platform === 'win32'
        ? { command: 'cmd', args: ['/c', 'npx', 'rollup', '-c', 'rollup.config.js'] }
        : { command: 'npx', args: ['rollup', '-c', 'rollup.config.js'] };

    const rollupResult = spawnSync(rollupCommand.command, rollupCommand.args, {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: false
    });

    if (rollupResult.status !== 0) {
      process.exit(rollupResult.status ?? 1);
    }
  }

  // Resolve js-hook.cjs: check cwd first, fall back to repoRoot
  const jsHookFromCwd = path.join(process.cwd(), '.vscode', 'js-hook.cjs');
  const jsHookPath = fs.existsSync(jsHookFromCwd) ? jsHookFromCwd : path.join(repoRoot, '.vscode', 'js-hook.cjs');

  const nodeArgs = ['--no-warnings=ExperimentalWarning', '-r', jsHookPath, bundle.output, ...args];

  if (command === 'launch') {
    const child = spawn(process.execPath, nodeArgs, {
      cwd: repoRoot,
      detached: true,
      stdio: 'ignore',
      shell: false,
      windowsHide: true
    });

    child.unref();
    process.exit(0);
  }

  const child = spawn(process.execPath, nodeArgs, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
    windowsHide: true
  });

  child.on('exit', (code) => process.exit(code ?? 0));
  child.on('error', (error) => {
    console.error(error);
    process.exit(1);
  });
}

/**
 * Run the check runner command via Node with optional ts-node loader.
 * @param {string[]} args - Remaining arguments to forward.
 */
function runCheckCommand(args) {
  const bundle = resolveRunner('check');

  if (!bundle) {
    console.error('Unknown command: check');
    process.exit(1);
  }

  // Resolve js-hook.cjs: check cwd first, fall back to repoRoot
  const jsHookFromCwd = path.join(process.cwd(), '.vscode', 'js-hook.cjs');
  const jsHookPath = fs.existsSync(jsHookFromCwd) ? jsHookFromCwd : path.join(repoRoot, '.vscode', 'js-hook.cjs');

  const checkRunner = bundle.output ?? bundle.input;
  const useTsLoader = checkRunner.endsWith('.ts');
  const child = spawn(
    process.execPath,
    [
      '--no-warnings=ExperimentalWarning',
      ...(useTsLoader ? ['--loader', 'ts-node/esm'] : []),
      '-r',
      jsHookPath,
      checkRunner,
      ...args
    ],
    {
      cwd: repoRoot,
      stdio: 'inherit',
      shell: false,
      windowsHide: true
    }
  );

  child.on('exit', (code) => process.exit(code ?? 0));
  child.on('error', (error) => {
    console.error(error);
    process.exit(1);
  });
}

/**
 * Entry point — parses CLI args and dispatches to the appropriate runner.
 */
function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log('Usage: pp <launch|skrin|check|skrin-check> [options] [-- args]');
    process.exit(0);
  }

  const maybePythonExitCode = runParallelPython(args);
  if (maybePythonExitCode !== null) {
    process.exit(maybePythonExitCode);
  }

  const subcommand = String(args[0]).toLowerCase();
  const remainingArgs = args.slice(1);

  if (subcommand === 'check') {
    runCheckCommand(remainingArgs);
    return;
  }

  if (subcommand === 'launch' || subcommand === 'skrin' || subcommand === 'skrin-check') {
    runBundledCommand(subcommand, remainingArgs);
    return;
  }

  console.error(`Unknown command: ${args[0]}`);
  process.exit(1);
}

main();
