import { jsonParseWithCircularRefs, jsonStringifyWithCircularRefs, writefile } from 'sbg-utility';
import path from 'upath';
import fs from 'fs-extra';

type EndpointLock = {
  ownerPid: number;
  claimedAt: string;
};

export default class EndpointManager {
  basePath: string;
  endpointFile: string;
  endpointLocksPath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.endpointFile = path.join(this.basePath, 'endpoint.json');
    this.endpointLocksPath = path.join(this.basePath, 'endpoint-locks');
    fs.ensureDirSync(this.basePath);
    fs.ensureDirSync(this.endpointLocksPath);
  }

  private parseEndpoints(content: string): string[] {
    if (!content) return [];
    return jsonParseWithCircularRefs<string[]>(content);
  }

  private getEndpointLockPath(endpoint: string) {
    return path.join(this.endpointLocksPath, `${encodeURIComponent(endpoint)}.json`);
  }

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

  private isProcessRunning(pid: number): boolean {
    try {
      // signal 0 does not kill the process, only tests for existence
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

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

  isEndpointLocked(endpoint: string): boolean {
    return Boolean(this.getActiveEndpointLock(endpoint));
  }

  readEndpoints(): string[] {
    try {
      const content = fs.readFileSync(this.endpointFile, 'utf8').trim();
      return this.parseEndpoints(content);
    } catch {
      return [];
    }
  }

  writeEndpoint(endpoint: string) {
    const endpoints = this.readEndpoints();
    const uniqueEndpoints = Array.from(new Set([...endpoints, endpoint]));
    writefile(this.endpointFile, jsonStringifyWithCircularRefs(uniqueEndpoints));
  }

  removeEndpoint(endpoint: string) {
    const endpoints = this.readEndpoints().filter((item) => item !== endpoint);
    writefile(this.endpointFile, jsonStringifyWithCircularRefs(endpoints));
    // remove any lock file
    const lockPath = this.getEndpointLockPath(endpoint);
    fs.removeSync(lockPath);
  }

  getAvailableEndpoint(): string | undefined {
    const endpoints = this.readEndpoints();
    if (!endpoints.length) return undefined;
    return endpoints.find((endpoint) => !this.isEndpointLocked(endpoint));
  }

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
