'use strict';

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');

let countProcesses;
let spawnSync;

function mockPlatform(platform) {
  Object.defineProperty(process, 'platform', {
    configurable: true,
    value: platform
  });
}

function loadHelper(platform = 'linux') {
  jest.resetModules();

  mockPlatform(platform);

  jest.doMock('node:child_process', () => ({
    ...jest.requireActual('node:child_process'),
    spawnSync: jest.fn()
  }));

  countProcesses = require('../../src/utils/get_total_processes.cjs');
  spawnSync = require('node:child_process').spawnSync;

  return countProcesses;
}

afterEach(() => {
  jest.dontMock('node:child_process');

  Object.defineProperty(process, 'platform', originalPlatform);

  jest.resetModules();
  jest.clearAllMocks();
});

describe('countProcesses', () => {
  describe('Linux', () => {
    beforeEach(() => {
      loadHelper('linux');

      spawnSync.mockReturnValue({
        status: 0,
        stdout: [
          'node node server.js',
          'node node worker.js',
          'node node file.path',
          'npm npm run start',
          'bash /bin/bash'
        ].join('\n'),
        stderr: ''
      });
    });

    test('should count all Node.js processes without arguments', () => {
      expect(countProcesses('node')).toBe(3);
    });

    test('should use node as the default executable', () => {
      expect(countProcesses()).toBe(3);
    });

    test('should count processes with a specific argument', () => {
      expect(countProcesses('node', 'file.path')).toBe(1);
    });

    test('should count processes with multiple arguments', () => {
      spawnSync.mockReturnValue({
        status: 0,
        stdout: [
          'node node file.path --watch',
          'node node file.path --inspect',
          'node node file.path',
          'node node another.js --watch'
        ].join('\n'),
        stderr: ''
      });

      expect(countProcesses('node', ['file.path', '--watch'])).toBe(1);
    });

    test('should not match partial arguments', () => {
      spawnSync.mockReturnValue({
        status: 0,
        stdout: ['node node file.path', 'node node file.path-extra', 'node node another-file.path'].join('\n'),
        stderr: ''
      });

      expect(countProcesses('node', 'file.path')).toBe(1);
    });

    test('should ignore different executables', () => {
      expect(countProcesses('npm')).toBe(1);
    });

    test('should execute ps with the correct arguments', () => {
      countProcesses('node');

      expect(spawnSync).toHaveBeenCalledWith(
        'ps',
        ['-eo', 'comm=,args='],
        expect.objectContaining({
          encoding: 'utf8'
        })
      );
    });
  });

  describe('Windows', () => {
    beforeEach(() => {
      loadHelper('win32');

      spawnSync.mockReturnValue({
        status: 0,
        stdout: JSON.stringify([
          {
            Name: 'node.exe',
            CommandLine: '"C:\\Program Files\\nodejs\\node.exe" server.js'
          },
          {
            Name: 'node.exe',
            CommandLine: 'node.exe worker.js'
          },
          {
            Name: 'node.exe',
            CommandLine: 'node.exe file.path'
          },
          {
            Name: 'npm.exe',
            CommandLine: 'npm run start'
          },
          {
            Name: 'bash.exe',
            CommandLine: 'bash.exe'
          }
        ]),
        stderr: ''
      });
    });

    test('should count all Node.js processes without arguments', () => {
      expect(countProcesses('node')).toBe(3);
    });

    test('should match node.exe as node', () => {
      expect(countProcesses('node.exe')).toBe(3);
    });

    test('should count processes with a specific argument', () => {
      expect(countProcesses('node', 'file.path')).toBe(1);
    });

    test('should support multiple arguments', () => {
      spawnSync.mockReturnValue({
        status: 0,
        stdout: JSON.stringify([
          {
            Name: 'node.exe',
            CommandLine: 'node.exe file.path --watch'
          },
          {
            Name: 'node.exe',
            CommandLine: 'node.exe file.path --inspect'
          }
        ]),
        stderr: ''
      });

      expect(countProcesses('node', ['file.path', '--watch'])).toBe(1);
    });

    test('should handle a single process returned by PowerShell', () => {
      spawnSync.mockReturnValue({
        status: 0,
        stdout: JSON.stringify({
          Name: 'node.exe',
          CommandLine: 'node.exe server.js'
        }),
        stderr: ''
      });

      expect(countProcesses('node')).toBe(1);
    });

    test('should execute PowerShell with the correct arguments', () => {
      countProcesses('node');

      expect(spawnSync).toHaveBeenCalledWith(
        'powershell.exe',
        expect.arrayContaining(['-NoProfile', '-NonInteractive', '-Command']),
        expect.objectContaining({
          encoding: 'utf8',
          windowsHide: true
        })
      );
    });
  });

  describe('Validation', () => {
    beforeEach(() => {
      loadHelper('linux');
    });

    test('should reject an empty executable', () => {
      expect(() => countProcesses('')).toThrow(TypeError);
    });

    test('should reject a non-string executable', () => {
      expect(() => countProcesses(123)).toThrow(TypeError);
    });

    test('should reject invalid arguments', () => {
      expect(() => countProcesses('node', 123)).toThrow(TypeError);
    });

    test('should reject arrays containing non-string arguments', () => {
      expect(() => countProcesses('node', ['server.js', 123])).toThrow(TypeError);
    });

    test('should reject unsupported platforms', () => {
      mockPlatform('darwin');

      expect(() => countProcesses('node')).toThrow('Unsupported platform: darwin');
    });
  });

  describe('Process command errors', () => {
    beforeEach(() => {
      loadHelper('linux');
    });

    test('should throw when spawnSync returns an error', () => {
      spawnSync.mockReturnValue({
        error: new Error('Command execution failed'),
        status: null,
        stdout: '',
        stderr: ''
      });

      expect(() => countProcesses('node')).toThrow('Command execution failed');
    });

    test('should throw when command exits unsuccessfully', () => {
      spawnSync.mockReturnValue({
        status: 1,
        stdout: '',
        stderr: 'Permission denied'
      });

      expect(() => countProcesses('node')).toThrow('Permission denied');
    });

    test('should return zero when no processes exist', () => {
      spawnSync.mockReturnValue({
        status: 0,
        stdout: '',
        stderr: ''
      });

      expect(countProcesses('node')).toBe(0);
    });
  });
});
