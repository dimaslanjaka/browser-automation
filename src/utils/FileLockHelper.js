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
    // Normalize to absolute path immediately to avoid surprises
    this.filePath = path.resolve(filePath || '');
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
    const filePath = path.resolve(this.filePath);
    const lockDir = path.dirname(filePath);
    // Ensure directory exists (propagate any error to caller)
    fs.mkdirSync(lockDir, { recursive: true, mode: 0o777 });

    try {
      this.handle = fs.openSync(filePath, 'wx');
      // write metadata (best-effort) so other processes can detect stale locks
      try {
        const meta = JSON.stringify({ pid: process.pid, ts: Date.now(), cwd: process.cwd() });
        fs.writeSync(this.handle, meta, 0, 'utf8');
      } catch (_w) {
        // ignore write errors
      }
      this._bindProcessExitHooks();
      return true;
    } catch (error) {
      this.handle = null;
      // If the file already exists, attempt stale-lock detection and cleanup.
      if (error && error.code === 'EEXIST') {
        try {
          const raw = fs.readFileSync(filePath, 'utf8');
          let parsed = null;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch (_e) {
            parsed = null;
          }

          const pid = parsed && typeof parsed.pid === 'number' ? parsed.pid : null;
          const ts = parsed && typeof parsed.ts === 'number' ? parsed.ts : null;

          let mtimeMs = null;
          try {
            mtimeMs = fs.statSync(filePath).mtimeMs;
          } catch (_s) {
            mtimeMs = null;
          }

          const isPidRunning = (p) => {
            if (!p || typeof p !== 'number') return false;
            try {
              process.kill(p, 0);
              return true;
            } catch (_err) {
              return false;
            }
          };

          const STALE_MS = Number(process.env.FILELOCK_STALE_MS || 10 * 60 * 1000);
          const now = Date.now();
          const effectiveTs = ts || mtimeMs || 0;
          const isStale = effectiveTs === 0 ? true : now - effectiveTs > STALE_MS;

          // If lock file has a live PID and is not stale, treat as locked
          if (pid && isPidRunning(pid) && !isStale) return false;

          // If there's no PID but the file is recent, treat as locked
          if (!pid && effectiveTs !== 0 && now - effectiveTs <= STALE_MS) return false;

          // Otherwise consider it stale: try to remove and acquire once
          try {
            fs.unlinkSync(filePath);
          } catch (_unlinkErr) {
            return false;
          }

          try {
            this.handle = fs.openSync(filePath, 'wx');
            try {
              const meta = JSON.stringify({ pid: process.pid, ts: Date.now(), cwd: process.cwd() });
              fs.writeSync(this.handle, meta, 0, 'utf8');
            } catch (_w2) {
              // ignore
            }
            this._bindProcessExitHooks();
            return true;
          } catch (_retryErr) {
            this.handle = null;
            return false;
          }
        } catch (_readErr) {
          // can't read metadata — fallback: treat as locked
          return false;
        }
      }

      // For other errors (permissions, invalid path, ENOENT, etc.) surface them.
      throw error;
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
    const filePath = path.resolve(this.filePath);
    const lockDir = path.dirname(filePath);

    // If lock directory doesn't exist, there can't be a lock file
    if (!fs.existsSync(lockDir)) return false;
    if (!fs.existsSync(filePath)) return false;

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      let parsed = null;
      try {
        parsed = raw ? JSON.parse(raw) : null;
      } catch (_e) {
        parsed = null;
      }

      const pid = parsed && typeof parsed.pid === 'number' ? parsed.pid : null;
      const ts = parsed && typeof parsed.ts === 'number' ? parsed.ts : null;

      let mtimeMs = null;
      try {
        mtimeMs = fs.statSync(filePath).mtimeMs;
      } catch (_s) {
        mtimeMs = null;
      }

      const isPidRunning = (p) => {
        if (!p || typeof p !== 'number') return false;
        try {
          process.kill(p, 0);
          return true;
        } catch (_err) {
          return false;
        }
      };

      const STALE_MS = Number(process.env.FILELOCK_STALE_MS || 10 * 60 * 1000);
      const now = Date.now();
      const effectiveTs = ts || mtimeMs || 0;
      const isStale = effectiveTs === 0 ? true : now - effectiveTs > STALE_MS;

      // Live pid and not stale => locked
      if (pid && isPidRunning(pid) && !isStale) return true;
      // No pid but recent file => consider locked
      if (!pid && effectiveTs !== 0 && now - effectiveTs <= STALE_MS) return true;
      // otherwise not locked
      return false;
    } catch (_err) {
      // If we can't read the file for any reason, fallback to existence check
      return fs.existsSync(filePath);
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
