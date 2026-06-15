#!/usr/bin/env node

import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const parallelScript = path.join(repoRoot, 'bin', 'pp.py');

/**
 * Resolve the correct source directory: src/ if present (dev), else lib/ (bundled).
 * Falls back to repoRoot if neither exists.
 * @returns {string} Absolute path to the active source directory.
 */
function findSourceDir() {
  const dev = path.join(repoRoot, 'src');
  if (fs.existsSync(dev) && fs.statSync(dev).isDirectory()) {
    return dev;
  }

  const bundled = path.join(repoRoot, 'lib');
  if (fs.existsSync(bundled) && fs.statSync(bundled).isDirectory()) {
    return bundled;
  }

  return repoRoot;
}

/**
 * Resolve a runner command to its source or built mode configuration.
 * @param {string} command - The subcommand name (launch, skrin, skrin-check, check).
 * @returns {{mode: string, input: string, output: string|null}|null} Runner config or null if unknown.
 */
function resolveRunner(command) {
  const srcDir = findSourceDir();
  const isBundled = path.basename(srcDir) === 'lib';

  const runners = {
    launch: { name: 'launcher', hasOutput: true },
    skrin: { name: 'skrin', hasOutput: true },
    'skrin-check': { name: 'skrin-check-data', hasOutput: true },
    check: { name: 'check', hasOutput: false }
  };

  const runner = runners[command];
  if (!runner) {
    return null;
  }

  const subDir = path.join(srcDir, 'puppeteer', 'parallel');

  if (isBundled) {
    const input = path.join(subDir, `${runner.name}.runner.mjs`);
    const output = runner.hasOutput ? path.join(subDir, `${runner.name}.mjs`) : null;

    if (!fs.existsSync(input)) {
      return null;
    }

    return {
      mode: 'built',
      input,
      output
    };
  }

  // Development mode (src/)
  const input = path.join(subDir, `${runner.name}.runner.ts`);
  const output = runner.hasOutput ? path.join(repoRoot, 'dist', 'parallel', `${runner.name}.cjs`) : null;

  if (!fs.existsSync(input)) {
    return null;
  }

  return {
    mode: 'source',
    input,
    output
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
function runBundledCommand(command, args, sameTerminal = false) {
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

  if (command === 'launch' && !sameTerminal) {
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
 * Print help text matching pp.py's output.
 */
function printHelp() {
  const help = `usage: pp.mjs [-h] [-k] [-s] [-f] {launch,skrin,check,skrin-check}

Wrapper to build and run parallel bundles (launcher, skrin, etc.).
This script will build the requested bundle if missing and then run it with Node.

positional arguments:
  {launch,skrin,check,skrin-check}
                        Which parallel command to build/run (see Commands section).

options:
  -h, --help            show this help message and exit
  -k, --keep-open       Keep the launched process console open after it exits.
  -s, --same-terminal   Run the process in the same terminal (blocking).
  -f, --force           Force rebuild and bypass cache check (useful for debugging).

Commands:
  launch       Build & run the launcher bundle.
  skrin        Build & run the skrin bundle.
  skrin-check  Build & run the skrin-check-data bundle.
  check        Run the local TypeScript check script (no bundling).

Options:
  -k, --keep-open     Keep the launched process console open after it exits.
  -s, --same-terminal Run the process in the same terminal (blocking).

Notes:
  Any remaining arguments are forwarded to the underlying script.
  Providing \`-h\` or \`--help\` after the command will print this top-level help
  and still forward the help flag to the bundled script so it can print its own help.

Examples:
  node ${__filename} skrin -s -- -h
  node ${__filename} launch -k
`;
  console.log(help);
}

/**
 * Extract the subcommand from args (it can appear anywhere among flags,
 * like argparse allows). Returns { subcommand, rest } where rest are the
 * remaining args with the subcommand removed.
 *
 * @param {string[]} args
 * @returns {{ subcommand: string|null, rest: string[] }}
 */
function extractSubcommand(args) {
  const validCommands = new Set(['launch', 'skrin', 'check', 'skrin-check']);
  const flags = new Set(['-h', '--help', '-k', '--keep-open', '-s', '--same-terminal', '-f', '--force']);

  for (let i = 0; i < args.length; i++) {
    // Skip flags and their possible values
    if (flags.has(args[i]) || args[i].startsWith('-')) {
      continue;
    }
    // Found a positional arg — check if it's a valid command
    if (validCommands.has(args[i].toLowerCase())) {
      const rest = [...args];
      rest.splice(i, 1);
      return { subcommand: args[i].toLowerCase(), rest };
    }
  }

  return { subcommand: null, rest: args };
}

/**
 * Entry point — parses CLI args and dispatches to the appropriate runner.
 * Mirrors pp.py's argument parsing and behavior.
 */
function main() {
  const rawArgs = process.argv.slice(2);

  // No args → show help
  if (rawArgs.length === 0) {
    printHelp();
    process.exit(0);
  }

  // Top-level --help — mirror pp.py: exit immediately if first arg is -h/--help
  if (rawArgs[0] === '-h' || rawArgs[0] === '--help') {
    printHelp();
    process.exit(0);
  }

  // Extract subcommand (it may be anywhere among flags, like argparse)
  const { subcommand, rest: argsWithoutCommand } = extractSubcommand(rawArgs);

  if (!subcommand) {
    console.error(`Unknown command: ${rawArgs[0]}`);
    console.error('Valid commands: launch, skrin, skrin-check, check');
    process.exit(1);
  }

  // Parse known flags from remaining args; everything else is forwarded
  const forwardedArgs = [];
  let sameTerminal = false;

  for (let i = 0; i < argsWithoutCommand.length; i++) {
    const arg = argsWithoutCommand[i];
    switch (arg) {
      case '-k':
      case '--keep-open':
        // keep_open — consumed, not used in native fallback
        break;
      case '-s':
      case '--same-terminal':
        sameTerminal = true;
        break;
      case '-f':
      case '--force':
        // force — consumed, not used in native fallback
        break;
      case '--':
        // Everything after -- is forwarded as-is
        forwardedArgs.push(...argsWithoutCommand.slice(i + 1));
        i = argsWithoutCommand.length; // break loop
        break;
      default:
        forwardedArgs.push(arg);
    }
  }

  // If -h/--help is among forwarded args, print help first
  const forwardHelp = forwardedArgs.includes('-h') || forwardedArgs.includes('--help');
  if (forwardHelp) {
    printHelp();
    console.log();
    sameTerminal = true;
  }

  // Reconstruct args for python delegation (including flags for fidelity)
  const pythonArgs = [subcommand, ...argsWithoutCommand];

  // Try delegating to python first (dev mode convenience)
  const maybePythonExitCode = runParallelPython(pythonArgs);
  if (maybePythonExitCode !== null) {
    process.exit(maybePythonExitCode);
  }

  // Fallback: native JS handling
  if (subcommand === 'check') {
    runCheckCommand(forwardedArgs);
    return;
  }

  if (subcommand === 'launch' || subcommand === 'skrin' || subcommand === 'skrin-check') {
    runBundledCommand(subcommand, forwardedArgs, sameTerminal);
    return;
  }

  console.error(`Unknown command: ${subcommand}`);
  process.exit(1);
}

main();
