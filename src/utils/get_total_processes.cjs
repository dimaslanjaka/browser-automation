'use strict';

const { spawnSync } = require('node:child_process');
const path = require('node:path');

/**
 * Escape a string for use in a regular expression.
 *
 * @param {string} value
 * @returns {string}
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check whether a command line contains an exact argument.
 *
 * Supports quoted arguments and paths containing spaces.
 *
 * @param {string} commandLine
 * @param {string} argument
 * @returns {boolean}
 */
function hasArgument(commandLine, argument) {
  const escaped = escapeRegExp(argument);

  const regex = new RegExp(`(?:^|\\s|["'])${escaped}(?=$|\\s|["'])`);

  return regex.test(commandLine);
}

/**
 * Get running processes on Windows.
 *
 * @returns {Array<{name: string, commandLine: string}>}
 */
function getWindowsProcesses() {
  const script = [
    '$ErrorActionPreference = "Stop"',
    'Get-CimInstance Win32_Process |',
    'Select-Object Name, CommandLine |',
    'ConvertTo-Json -Compress -Depth 2'
  ].join(' ');

  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    encoding: 'utf8',
    windowsHide: true,
    maxBuffer: 50 * 1024 * 1024
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || 'Failed to retrieve Windows processes');
  }

  const output = result.stdout.trim();

  if (!output) {
    return [];
  }

  const processes = JSON.parse(output);

  return (Array.isArray(processes) ? processes : [processes]).map((process) => ({
    name: process.Name || '',
    commandLine: process.CommandLine || ''
  }));
}

/**
 * Get running processes on Linux.
 *
 * @returns {Array<{name: string, commandLine: string}>}
 */
function getLinuxProcesses() {
  const result = spawnSync('ps', ['-eo', 'comm=,args='], {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(result.stderr || 'Failed to retrieve Linux processes');
  }

  return result.stdout
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const match = line.trim().match(/^(\S+)\s*(.*)$/);

      return {
        name: match?.[1] || '',
        commandLine: match?.[2] || ''
      };
    });
}

/**
 * Count running processes by executable and optional arguments.
 *
 * @param {string} executable Executable name, e.g. "node".
 * @param {string|string[]} [args=[]] Arguments to match exactly.
 * @returns {number}
 *
 * @example
 * countProcesses('node');
 * countProcesses('node', 'file.path');
 * countProcesses('node', ['file.path', '--watch']);
 */
function countProcesses(executable = 'node', args = []) {
  if (typeof executable !== 'string' || !executable.trim()) {
    throw new TypeError('executable must be a non-empty string');
  }

  if (typeof args === 'string') {
    args = [args];
  }

  if (!Array.isArray(args) || !args.every((arg) => typeof arg === 'string')) {
    throw new TypeError('args must be a string or an array of strings');
  }

  const platform = process.platform;

  let processes;

  if (platform === 'win32') {
    processes = getWindowsProcesses();
  } else if (platform === 'linux') {
    processes = getLinuxProcesses();
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const expectedName = path.posix
    .basename(executable.replace(/\\/g, '/'))
    .toLowerCase()
    .replace(/\.exe$/, '');

  return processes.filter((process) => {
    const actualName = path.posix
      .basename(process.name.replace(/\\/g, '/'))
      .toLowerCase()
      .replace(/\.exe$/, '');

    if (actualName !== expectedName) {
      return false;
    }

    if (args.length === 0) {
      return true;
    }

    return args.every((argument) => hasArgument(process.commandLine, argument));
  }).length;
}

module.exports = countProcesses;
module.exports.countProcesses = countProcesses;
module.exports.getWindowsProcesses = getWindowsProcesses;
module.exports.getLinuxProcesses = getLinuxProcesses;
