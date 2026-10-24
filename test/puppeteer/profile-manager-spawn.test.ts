import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { describe, test, expect } from '@jest/globals';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type LauncherState = {
  name: string;
  child: ReturnType<typeof spawn>;
  stdout: string;
  stderr: string;
  closed: boolean;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
};

function startLauncher(name: string, args: string[]): LauncherState {
  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env }
  });

  const state: LauncherState = {
    name,
    child,
    stdout: '',
    stderr: '',
    closed: false,
    exitCode: null,
    signal: null
  };

  child.stdout!.on('data', (data) => {
    const output = data.toString();
    state.stdout += output;
    process.stdout.write(`[${name}] ${output}`);
  });

  child.stderr!.on('data', (data) => {
    const output = data.toString();
    state.stderr += output;
    process.stderr.write(`[${name}] ${output}`);
  });

  child.on('error', (error) => {
    state.stderr += `\nSpawn error: ${error.message}`;
  });

  child.on('close', (code, signal) => {
    state.closed = true;
    state.exitCode = code;
    state.signal = signal;
  });

  return state;
}

async function waitForOutput(state: LauncherState, text: string, timeoutMs = 30_000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (state.stdout.includes(text)) return;

    if (state.closed) {
      throw new Error(
        `${state.name} exited before output "${text}".\n` +
          `Exit code: ${state.exitCode}\nSTDOUT:\n${state.stdout}\nSTDERR:\n${state.stderr}`
      );
    }
    await sleep(100);
  }

  throw new Error(
    `Timeout waiting for "${text}" from ${state.name}.\n` + `STDOUT:\n${state.stdout}\nSTDERR:\n${state.stderr}`
  );
}

function killTree(state: LauncherState) {
  if (state.closed || !state.child.pid) return;

  if (process.platform === 'win32') {
    // Bunuh seluruh process tree (termasuk Chrome dari Puppeteer)
    spawnSync('taskkill', ['/pid', String(state.child.pid), '/T', '/F'], { windowsHide: true });
  } else {
    state.child.kill('SIGTERM');
  }
}

function printLogs(states: Array<LauncherState | undefined>) {
  console.log('\n--- Final launcher logs ---');
  for (const state of states.filter(Boolean) as LauncherState[]) {
    console.log(`\n${state.name}`);
    console.log('Exit code:', state.exitCode);
    console.log('STDOUT:\n', state.stdout);
    console.log('STDERR:\n', state.stderr);
  }
}

describe('Profile Manager - Multiple Launchers', () => {
  test('launches two processes with a delay and captures logs', async () => {
    const script = path.resolve('src/puppeteer/parallel/launcher.runner.ts');
    const args = [
      '--no-warnings=ExperimentalWarning',
      '--loader',
      'ts-node/esm',
      '-r',
      './.vscode/js-hook.cjs',
      script
    ];

    let first: LauncherState | undefined;
    let second: LauncherState | undefined;

    try {
      first = startLauncher('Launcher 1', args);
      await waitForOutput(first, 'User Data Dir');

      // Launcher 1 tetap hidup selama 10 detik sebelum launcher 2 mulai
      await sleep(10_000);
      expect(first.closed).toBe(false);

      second = startLauncher('Launcher 2', args);
      await waitForOutput(second, 'User Data Dir');

      // Kedua proses harus hidup bersamaan
      expect(first.closed).toBe(false);
      expect(second.closed).toBe(false);

      // Assertion pada kedua log
      expect(first.stdout).toMatch(/profile1\b/);
      expect(second.stdout).toMatch(/profile2\b/);

      // Profile tidak boleh tertukar
      expect(first.stdout).not.toMatch(/profile2\b/);
      expect(second.stdout).not.toMatch(/profile1\b/);
    } finally {
      printLogs([first, second]); // tetap tercetak walau assertion gagal

      for (const state of [second, first]) {
        if (state) killTree(state);
      }

      await Promise.all(
        [second, first].map(async (state) => {
          if (!state || state.closed) return;
          await Promise.race([
            new Promise<void>((resolve) => state.child.once('close', () => resolve())),
            sleep(5_000)
          ]);
        })
      );
    }
  }, 90_000);
});
