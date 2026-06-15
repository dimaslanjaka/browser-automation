import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Global shared directory for browser profile data, using the OS temp folder so
 * that all processes (regardless of working directory) share the same profiles.
 */
export const GLOBAL_PROFILES_DIR = path.join(os.tmpdir(), 'browser-automation-puppeteer', 'profiles');

/**
 * Returns the first available fallback profile directory path.
 *
 * @param {number} [startIndex=1] - First profile index to probe.
 * @param {string[]} [excludedDirs=[]] - Directories to skip when selecting fallback profile.
 * @returns {string}
 */
export function getFallbackProfileDir(startIndex = 1, excludedDirs = []) {
  const profilesRootDir = GLOBAL_PROFILES_DIR;
  let index = Math.max(1, Number(startIndex) || 1);
  const excludedDirSet = new Set(excludedDirs.map((dir) => path.resolve(dir)));

  const isUserDataDirInUse = (targetUserDataDir) => {
    if (!targetUserDataDir) return false;
    const resolvedUserDataDir = path.resolve(targetUserDataDir);
    const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'LOCK'];
    return lockFiles.some((fileName) => fs.existsSync(path.join(resolvedUserDataDir, fileName)));
  };

  while (true) {
    const profileDir = path.join(profilesRootDir, `profile${index}`);
    if (!excludedDirSet.has(profileDir) && !isUserDataDirInUse(profileDir)) {
      return profileDir;
    }
    index += 1;
  }
}
