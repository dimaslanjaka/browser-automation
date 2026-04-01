import fs from 'fs';
import path from 'path';
import { FileLockHelper } from '../../src/utils/FileLockHelper.js';

describe('FileLockHelper', () => {
  const lockDir = path.join(process.cwd(), 'tmp', 'test-locks');
  const lockFile = path.join(lockDir, 'test.lock');

  beforeAll(() => {
    // shorten stale threshold for tests
    process.env.FILELOCK_STALE_MS = String(1000);
    fs.mkdirSync(lockDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(lockFile)) {
      try {
        fs.unlinkSync(lockFile);
      } catch (_) {
        // Ignore errors during cleanup
      }
    }
  });

  afterAll(() => {
    if (fs.existsSync(lockFile)) {
      try {
        fs.unlinkSync(lockFile);
      } catch (_) {
        // Ignore errors during cleanup
      }
    }
    try {
      fs.rmdirSync(lockDir);
    } catch (_) {
      // Ignore errors during cleanup
    }
  });

  test('acquires and releases lock', () => {
    const lock = new FileLockHelper(lockFile);
    expect(lock.isLocked()).toBe(false);
    expect(lock.lock()).toBe(true);
    expect(lock.isLocked()).toBe(true);
    lock.unlock();
    expect(fs.existsSync(lockFile)).toBe(false);
  });

  test('removes stale lock and acquires', () => {
    const staleTs = Date.now() - 2000; // older than FILELOCK_STALE_MS
    const meta = JSON.stringify({ pid: 999999, ts: staleTs });
    fs.writeFileSync(lockFile, meta, 'utf8');
    // set mtime to stale time as well
    fs.utimesSync(lockFile, new Date(staleTs), new Date(staleTs));

    const locker = new FileLockHelper(lockFile);
    expect(locker.lock()).toBe(true);
    locker.unlock();
    expect(fs.existsSync(lockFile)).toBe(false);
  });

  test('does not acquire when recent non-metadata file exists', () => {
    fs.writeFileSync(lockFile, 'garbage', 'utf8');
    fs.utimesSync(lockFile, new Date(), new Date());

    const locker = new FileLockHelper(lockFile);
    expect(locker.lock()).toBe(false);
    // cleanup
    try {
      fs.unlinkSync(lockFile);
    } catch {
      // Ignore errors during cleanup
    }
  });

  test('does not acquire when lock file has live pid', () => {
    const meta = JSON.stringify({ pid: process.pid, ts: Date.now() });
    fs.writeFileSync(lockFile, meta, 'utf8');
    fs.utimesSync(lockFile, new Date(), new Date());

    const locker = new FileLockHelper(lockFile);
    expect(locker.lock()).toBe(false);
    try {
      fs.unlinkSync(lockFile);
    } catch {
      // Ignore errors during cleanup
    }
  });
});
