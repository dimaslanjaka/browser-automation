#!/usr/bin/env node

import { spawn } from 'child_process';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const jsHookPath = path.join(repoRoot, '.vscode', 'js-hook.cjs');
const sourceExtensions = ['.ts', '.js', '.mjs', '.cjs'];
const builtExtensions = ['.mjs', '.js', '.cjs'];

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
 * Resolve the first existing file from a base path and extension list.
 * @param {string} basePath - Absolute path without extension.
 * @param {string[]} extensions - Extensions to try in order.
 * @returns {string|null} First existing file path or null.
 */
function resolveFileWithExtensions(basePath, extensions) {
  for (const extension of extensions) {
    const candidate = `${basePath}${extension}`;
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Build Node arguments for a runner file.
 * The js-hook is only loaded when present (development); it is skipped in production.
 * @param {string} runnerPath - Absolute runner file path.
 * @param {string[]} args - Arguments to forward.
 * @returns {string[]} Node process arguments.
 */
function createNodeArgs(runnerPath, args) {
  const tsLoader = runnerPath.endsWith('.ts') ? ['--loader', 'ts-node/esm'] : [];
  const jsHook = fs.existsSync(jsHookPath) ? ['-r', jsHookPath] : [];
  return ['--no-warnings=ExperimentalWarning', ...tsLoader, ...jsHook, runnerPath, ...args];
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
    const input = resolveFileWithExtensions(path.join(subDir, `${runner.name}.runner`), builtExtensions);
    const output = runner.hasOutput
      ? resolveFileWithExtensions(path.join(subDir, runner.name), builtExtensions)
      : input;

    if (!input || !output) {
      return null;
    }

    return {
      mode: 'built',
      input,
      output
    };
  }

  // Development mode (src/) runs the source runner directly.
  const input = resolveFileWithExtensions(path.join(subDir, `${runner.name}.runner`), sourceExtensions);

  if (!input) {
    return null;
  }

  return {
    mode: 'source',
    input,
    output: input
  };
}

/**
 * Run a runner command via Node.
 * @param {string} command - The subcommand name.
 * @param {string[]} args - Remaining arguments to forward.
 * @param {boolean} sameTerminal - Whether to run in the current terminal.
 * @param {boolean} keepOpen - Whether to keep the terminal open after exit.
 */
function runBundledCommand(command, args, sameTerminal = false, keepOpen = false) {
  const bundle = resolveRunner(command);
  if (!bundle) {
    console.error(`Unknown command: ${command}`);
    process.exit(1);
  }

  const runnerPath = bundle.output ?? bundle.input;
  const nodeArgs = createNodeArgs(runnerPath, args);

  // Open in new terminal window for all commands unless -s/--same-terminal is specified
  const needsNewWindow = !sameTerminal;

  if (needsNewWindow) {
    if (process.platform === 'win32') {
      // Windows: open a new cmd window.
      // Use /k (keep open) when -k flag is set, otherwise /c (close after)
      const cmdFlag = keepOpen ? '/k' : '/c';
      const child = spawn('cmd', ['/c', 'start', '', 'cmd', cmdFlag, 'node', ...nodeArgs], {
        cwd: repoRoot,
        detached: true,
        stdio: 'ignore',
        shell: false,
        windowsHide: true
      });

      child.unref();
      process.exit(0);
    } else {
      // Unix: detached process (no persistent terminal emulation)
      const child = spawn(process.execPath, nodeArgs, {
        cwd: repoRoot,
        detached: true,
        stdio: 'ignore',
        shell: false
      });

      child.unref();
      process.exit(0);
    }
  }

  // Run in current terminal
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

  const checkRunner = bundle.output ?? bundle.input;
  const child = spawn(process.execPath, createNodeArgs(checkRunner, args), {
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
 * Print help text.
 */
function printHelp() {
  const help = `usage: pp.mjs [-h] [-k] [-s] [-f] {launch,skrin,check,skrin-check}

Wrapper to run parallel runners (launcher, skrin, etc.).
When src/ is available, this script runs the source runner directly with Node.

positional arguments:
  {launch,skrin,check,skrin-check}
                        Which parallel command to build/run (see Commands section).

options:
  -h, --help            show this help message and exit
  -k, --keep-open       Keep the launched process console open after it exits.
  -s, --same-terminal   Run the process in the same terminal (blocking).
  -f, --force           Force rebuild and bypass cache check (useful for debugging).

Commands:
  launch       Run the launcher runner.
  skrin        Run the skrin runner.
  skrin-check  Run the skrin-check-data runner.
  check        Run the local TypeScript check runner.

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
 */
function main() {
  const rawArgs = process.argv.slice(2);

  // No args → show help
  if (rawArgs.length === 0) {
    printHelp();
    process.exit(0);
  }

  // Top-level --help exits immediately if first arg is -h/--help
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
  let keepOpen = false;

  for (let i = 0; i < argsWithoutCommand.length; i++) {
    const arg = argsWithoutCommand[i];
    switch (arg) {
      case '-k':
      case '--keep-open':
        keepOpen = true;
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

  if (subcommand === 'check') {
    runCheckCommand(forwardedArgs);
    return;
  }

  if (subcommand === 'launch' || subcommand === 'skrin' || subcommand === 'skrin-check') {
    runBundledCommand(subcommand, forwardedArgs, sameTerminal, keepOpen);
    return;
  }

  console.error(`Unknown command: ${subcommand}`);
  process.exit(1);
}

main();
