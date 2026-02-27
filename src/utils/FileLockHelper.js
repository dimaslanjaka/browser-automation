import fs from 'fs';
import path from 'path';

/**
 * File-based lock helper for process synchronization.
 *
 * Note:
 * - Node.js has no built-in cross-platform advisory file-lock API like Python's
 *   `fcntl`/`msvcrt`.
 * - This implementation uses atomic lock-file creation (`wx`) as a portable,
 *   non-blocking lock strategy.
 */
export class FileLockHelper {
  /**
   * @param {string} filePath Path to lock file.
   */
  constructor(filePath) {
    this.filePath = filePath;
    this.handle = null;
    this.lockType = null;
    this._boundProcessEvents = [];
    this._onProcessExit = null;
  }

  /**
   * Acquire a lock.
   *
   * @param {'exclusive'|'shared'} lockType Lock type. Shared is treated as exclusive in this implementation.
   * @returns {boolean}
   */
  lock(lockType = 'exclusive') {
    this.lockType = lockType;

    if (!this._ensureLockDirWritable()) {
      return false;
    }

    try {
      this.handle = fs.openSync(this.filePath, 'wx');
      this._bindProcessExitHooks();
      return true;
    } catch (error) {
      this.handle = null;
      if (error && (error.code === 'EEXIST' || error.code === 'EACCES' || error.code === 'EPERM')) {
        return false;
      }
      return false;
    }
  }

  /**
   * Unlock and close handle.
   */
  unlock() {
    if (this.handle !== null) {
      try {
        fs.closeSync(this.handle);
      } catch (_error) {
        void _error;
      } finally {
        this.handle = null;
      }
    }

    this._unbindProcessExitHooks();

    try {
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath);
      }
    } catch (_error) {
      void _error;
    }
  }

  /**
   * Alias for unlock.
   */
  release() {
    this.unlock();
  }

  /**
   * Check if the lock is currently held by another process.
   *
   * @returns {boolean}
   */
  isLocked() {
    if (!this._ensureLockDirWritable()) {
      return fs.existsSync(this.filePath);
    }

    let tempHandle = null;
    try {
      tempHandle = fs.openSync(this.filePath, 'wx');
      fs.closeSync(tempHandle);
      if (fs.existsSync(this.filePath)) {
        fs.unlinkSync(this.filePath);
      }
      return false;
    } catch (error) {
      if (tempHandle !== null) {
        try {
          fs.closeSync(tempHandle);
        } catch (_closeError) {
          void _closeError;
        }
      }
      return error?.code === 'EEXIST' ? true : fs.existsSync(this.filePath);
    }
  }

  /**
   * Ensure lock directory exists and is writable.
   *
   * @returns {boolean}
   */
  _ensureLockDirWritable() {
    const lockDir = path.dirname(this.filePath);
    if (!lockDir || lockDir === '.') {
      return true;
    }

    try {
      fs.mkdirSync(lockDir, { recursive: true, mode: 0o777 });
      fs.accessSync(lockDir, fs.constants.W_OK);
      return true;
    } catch (_error) {
      return false;
    }
  }

  _bindProcessExitHooks() {
    if (this._onProcessExit) {
      return;
    }

    this._onProcessExit = () => {
      this.unlock();
    };

    const events = ['beforeExit', 'exit'];
    for (const eventName of events) {
      process.on(eventName, this._onProcessExit);
      this._boundProcessEvents.push(eventName);
    }
  }

  _unbindProcessExitHooks() {
    if (!this._onProcessExit) {
      return;
    }

    for (const eventName of this._boundProcessEvents) {
      process.off(eventName, this._onProcessExit);
    }

    this._boundProcessEvents = [];
    this._onProcessExit = null;
  }
}

export default FileLockHelper;
