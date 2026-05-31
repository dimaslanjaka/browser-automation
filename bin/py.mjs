#!/usr/bin/env node

import fs from 'fs';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const scriptDir = path.dirname(__filename);
const cwd = path.dirname(scriptDir);
const venvPath =
  fs.existsSync(path.join(cwd, 'venv')) || !fs.existsSync(path.join(cwd, '.venv'))
    ? path.join(cwd, 'venv')
    : path.join(cwd, '.venv');

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
 * Find a working Python interpreter by trying known command names.
 * @returns {string[]|null} The command and args array for Python, or null if not found.
 */
function findPythonCommand() {
  const candidates =
    process.platform === 'win32'
      ? [['python3.exe'], ['python.exe'], ['python'], ['py', '-3']]
      : [['python3'], ['python']];

  for (const candidate of candidates) {
    const [command, ...commandArgs] = candidate;
    if (hasCommand(command, commandArgs.length > 0 ? commandArgs : ['--version'])) {
      return candidate;
    }
  }

  return null;
}

/**
 * On Unix, symlink python -> python3 in the venv bin dir if python3 doesn't exist.
 */
function ensurePython3ShimUnix() {
  const pythonPath = path.join(venvPath, 'bin', 'python');
  const python3Path = path.join(venvPath, 'bin', 'python3');

  if (fs.existsSync(pythonPath) && !fs.existsSync(python3Path)) {
    fs.symlinkSync('python', python3Path);
  }
}

/**
 * On Windows, copy python.exe -> python3.exe in the venv Scripts dir if python3.exe doesn't exist.
 */
function ensurePython3ShimWindows() {
  const scriptsDir = path.join(venvPath, 'Scripts');
  const pythonPath = path.join(scriptsDir, 'python.exe');
  const python3Path = path.join(scriptsDir, 'python3.exe');

  if (fs.existsSync(pythonPath) && !fs.existsSync(python3Path)) {
    fs.copyFileSync(pythonPath, python3Path);
  }
}

/**
 * Resolve the Python binary path inside the venv on Unix.
 * @returns {string} Absolute path to python3 (or python as fallback).
 */
function resolvePythonBinUnix() {
  const python3Path = path.join(venvPath, 'bin', 'python3');
  return fs.existsSync(python3Path) ? python3Path : path.join(venvPath, 'bin', 'python');
}

/**
 * Resolve the Python binary path inside the venv on Windows.
 * @returns {string} Absolute path to python3.exe (or python.exe as fallback).
 */
function resolvePythonBinWindows() {
  const scriptsDir = path.join(venvPath, 'Scripts');
  const python3Path = path.join(scriptsDir, 'python3.exe');
  return fs.existsSync(python3Path) ? python3Path : path.join(scriptsDir, 'python.exe');
}

/**
 * Create a Python virtual environment for the project.
 * @throws {Error} If no Python interpreter is found.
 */
function createVirtualEnv() {
  const pythonCommand = findPythonCommand();
  if (!pythonCommand) {
    throw new Error('No Python interpreter found.');
  }

  const [command, ...commandArgs] = pythonCommand;
  const result = spawnSync(command, [...commandArgs, '-m', 'venv', venvPath], {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

/**
 * Run a Python script inside the project's virtual environment, creating one if needed.
 * @param {string[]} args - Arguments to pass to the Python interpreter.
 */
function runPython(args) {
  const pythonInVenv =
    process.platform === 'win32' ? path.join(venvPath, 'Scripts', 'python.exe') : path.join(venvPath, 'bin', 'python');

  if (!fs.existsSync(venvPath) || !fs.existsSync(pythonInVenv)) {
    createVirtualEnv();
  }

  if (process.platform === 'win32') {
    ensurePython3ShimWindows();
  } else {
    ensurePython3ShimUnix();
  }

  const pythonBin = process.platform === 'win32' ? resolvePythonBinWindows() : resolvePythonBinUnix();
  const result = spawnSync(pythonBin, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false
  });

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 0);
}

/**
 * Entry point — delegates to runPython with CLI arguments.
 */
function main() {
  const args = process.argv.slice(2);
  runPython(args);
}

main();
