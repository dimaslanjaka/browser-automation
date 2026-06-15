import os from 'os';
import { jsonParseWithCircularRefs, jsonStringifyWithCircularRefs, writefile } from 'sbg-utility';
import path from 'upath';
import fs from 'fs-extra';
import puppeteer from 'puppeteer';

/** Lock metadata attached to a claimed endpoint. */
type EndpointLock = {
  /** PID of the owning process. */
  ownerPid: number;
  /** ISO timestamp when the claim was made. */
  claimedAt: string;
};

/**
 * Global shared temp directory for all puppeteer parallel data, using the
 * OS temp folder so that all processes (regardless of working directory)
 * share the same state.
 */
export const GLOBAL_PUPPETEER_DIR = path.join(os.tmpdir(), 'browser-automation-puppeteer');

/**
 * Global shared directory for endpoint data, nested under {@link GLOBAL_PUPPETEER_DIR}.
 */
export const GLOBAL_ENDPOINT_MANAGER_PATH = path.join(GLOBAL_PUPPETEER_DIR, 'endpoints');

export class EndpointManager {
  /** Directory path for endpoint data. */
  basePath: string;
  /** Path to the JSON file holding all registered endpoints. */
  endpointFile: string;
  /** Directory path for per-endpoint lock files. */
  endpointLocksPath: string;

  /**
   * @param basePath - Directory to store endpoint data. Defaults to a
   *   fixed path under `os.tmpdir()` so all processes share the same
   *   endpoint registry regardless of their working directory.
   */
  constructor(basePath: string = GLOBAL_ENDPOINT_MANAGER_PATH) {
    this.basePath = basePath;
    this.endpointFile = path.join(this.basePath, 'endpoint.json');
    this.endpointLocksPath = path.join(this.basePath, 'endpoint-locks');
    fs.ensureDirSync(this.basePath);
    fs.ensureDirSync(this.endpointLocksPath);
  }

  /**
   * Parse raw file content into an array of endpoint strings.
   * @param content - Raw JSON string from the endpoint file.
   */
  private parseEndpoints(content: string): string[] {
    if (!content) return [];
    return jsonParseWithCircularRefs<string[]>(content);
  }

  /**
   * Build the filesystem path for the lock file of a given endpoint.
   * @param endpoint - The browser WebSocket endpoint URL.
   */
  private getEndpointLockPath(endpoint: string) {
    return path.join(this.endpointLocksPath, `${encodeURIComponent(endpoint)}.json`);
  }

  /**
   * Read and parse the lock file for an endpoint.
   * Returns `undefined` if the file does not exist or is unreadable.
   * @param endpoint - The browser WebSocket endpoint URL.
   */
  private readEndpointLock(endpoint: string): EndpointLock | undefined {
    const lockPath = this.getEndpointLockPath(endpoint);
    try {
      const content = fs.readFileSync(lockPath, 'utf8').trim();
      if (!content) return undefined;
      return jsonParseWithCircularRefs<EndpointLock>(content);
    } catch {
      return undefined;
    }
  }

  /**
   * Check whether a given PID is still alive.
   * Uses `process.kill(pid, 0)` which tests existence without sending a signal.
   * @param pid - Process ID to check.
   */
  private isProcessRunning(pid: number): boolean {
    try {
      // signal 0 does not kill the process, only tests for existence
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Return the lock for an endpoint if it exists and its owner is still alive.
   * Stale locks are cleaned up automatically.
   * @param endpoint - The browser WebSocket endpoint URL.
   */
  private getActiveEndpointLock(endpoint: string): EndpointLock | undefined {
    const lockPath = this.getEndpointLockPath(endpoint);
    const lock = this.readEndpointLock(endpoint);
    if (!lock?.ownerPid) {
      fs.removeSync(lockPath);
      return undefined;
    }

    if (!this.isProcessRunning(lock.ownerPid)) {
      fs.removeSync(lockPath);
      return undefined;
    }

    return lock;
  }

  /**
   * Check whether an endpoint has a live (non-stale) lock.
   * @param endpoint - The browser WebSocket endpoint URL.
   */
  isEndpointLocked(endpoint: string): boolean {
    return Boolean(this.getActiveEndpointLock(endpoint));
  }

  /**
   * Read all registered endpoint URLs from the shared JSON file.
   * Returns an empty array when the file does not exist yet or is unreadable.
   */
  readEndpoints(): string[] {
    try {
      const content = fs.readFileSync(this.endpointFile, 'utf8').trim();
      return this.parseEndpoints(content);
    } catch {
      return [];
    }
  }

  /**
   * Register an endpoint URL in the shared JSON file (deduplicated).
   * @param endpoint - The browser WebSocket endpoint URL to register.
   */
  writeEndpoint(endpoint: string) {
    const endpoints = this.readEndpoints();
    const uniqueEndpoints = Array.from(new Set([...endpoints, endpoint]));
    writefile(this.endpointFile, jsonStringifyWithCircularRefs(uniqueEndpoints));
  }

  /**
   * Remove an endpoint URL from the shared registry and delete its lock file.
   * @param endpoint - The browser WebSocket endpoint URL to remove.
   */
  removeEndpoint(endpoint: string) {
    const endpoints = this.readEndpoints().filter((item) => item !== endpoint);
    writefile(this.endpointFile, jsonStringifyWithCircularRefs(endpoints));
    // remove any lock file
    const lockPath = this.getEndpointLockPath(endpoint);
    fs.removeSync(lockPath);
  }

  /**
   * Checks if a Puppeteer endpoint is available by attempting Puppeteer.connect.
   */
  private async isPuppeteerEndpointAvailable(endpoint: string): Promise<boolean> {
    try {
      const browser = await puppeteer.connect({ browserWSEndpoint: endpoint });
      await browser.disconnect();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Returns the first available endpoint (not locked, not stale, and Puppeteer responds)
   */
  async getAvailableEndpoint(): Promise<string | undefined> {
    const endpoints = this.readEndpoints();
    if (!endpoints.length) return undefined;
    for (const endpoint of endpoints) {
      const lock = this.readEndpointLock(endpoint);
      if (lock && this.isProcessRunning(lock.ownerPid)) continue;
      const available = await this.isPuppeteerEndpointAvailable(endpoint);
      if (available) {
        return endpoint;
      }
    }
    return undefined;
  }

  /**
   * Returns all endpoints with their lock status, inactive status, and Puppeteer availability
   */
  async getAllActiveEndpoints(): Promise<
    Array<{
      endpoint: string;
      locked: boolean;
      inactive: boolean;
      ownerPid: number | null;
      claimedAt: string | null;
      puppeteerAvailable: boolean;
    }>
  > {
    const endpoints = this.readEndpoints();
    const results = [];
    for (const endpoint of endpoints) {
      const lock = this.readEndpointLock(endpoint);
      let locked = false;
      let inactive = false;
      let ownerPid = null;
      let claimedAt = null;
      if (lock) {
        ownerPid = lock.ownerPid;
        claimedAt = lock.claimedAt;
        if (this.isProcessRunning(lock.ownerPid)) {
          locked = true;
        } else {
          inactive = true;
        }
      }
      const puppeteerAvailable = await this.isPuppeteerEndpointAvailable(endpoint);
      results.push({
        endpoint,
        locked,
        inactive,
        ownerPid,
        claimedAt,
        puppeteerAvailable
      });
    }
    return results;
  }

  /**
   * Atomically claim an endpoint lock for a given process.
   * Fails if the endpoint is already locked by a different alive process.
   * @param endpoint - The browser WebSocket endpoint URL.
   * @param ownerPid - PID of the claiming process.
   * @returns `true` when the lock was acquired, `false` if already claimed.
   */
  tryClaimEndpoint(endpoint: string, ownerPid: number): boolean {
    fs.ensureDirSync(this.endpointLocksPath);
    const lockPath = this.getEndpointLockPath(endpoint);

    const existingLock = this.getActiveEndpointLock(endpoint);
    if (existingLock?.ownerPid && existingLock.ownerPid !== ownerPid) {
      return false;
    }

    const payload: EndpointLock = {
      ownerPid,
      claimedAt: new Date().toISOString()
    };

    try {
      const fd = fs.openSync(lockPath, 'wx');
      fs.writeFileSync(fd, jsonStringifyWithCircularRefs(payload));
      fs.closeSync(fd);
      return true;
    } catch (error: any) {
      if (error?.code === 'EEXIST') return false;
      throw error;
    }
  }

  /**
   * Release a claim on an endpoint. Only succeeds if the caller is the
   * current owner or the owning process is no longer alive.
   * @param endpoint - The browser WebSocket endpoint URL.
   * @param ownerPid - PID that originally claimed the endpoint.
   */
  releaseEndpointClaim(endpoint: string, ownerPid: number) {
    const lockPath = this.getEndpointLockPath(endpoint);
    const lock = this.readEndpointLock(endpoint);
    if (!lock?.ownerPid) {
      fs.removeSync(lockPath);
      return;
    }

    if (lock.ownerPid !== ownerPid && this.isProcessRunning(lock.ownerPid)) {
      return;
    }

    fs.removeSync(lockPath);
  }

  /**
   * Return the current lock status for every registered endpoint.
   * Does not perform a Puppeteer reachability check.
   */
  readEndpointStatus() {
    return this.readEndpoints().map((endpoint) => {
      const lock = this.getActiveEndpointLock(endpoint);
      return {
        endpoint,
        inUse: Boolean(lock),
        ownerPid: lock?.ownerPid
      };
    });
  }
}

export default EndpointManager;
