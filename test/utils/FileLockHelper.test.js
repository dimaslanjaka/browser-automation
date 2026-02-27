import fs from 'fs';
import path from 'path';
import { FileLockHelper } from '../../src/utils/FileLockHelper.js';

describe('FileLockHelper', () => {
  const lockDir = path.join(process.cwd(), 'tmp', 'test-locks');
  const lockFile = path.join(lockDir, 'test.lock');

  beforeAll(() => {
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
});
