import fs from 'fs';
import path from 'path';

/**
 * Returns the first available fallback profile directory path.
 *
 * @param {number} [startIndex=1] - First profile index to probe.
 * @param {string[]} [excludedDirs=[]] - Directories to skip when selecting fallback profile.
 * @returns {string}
 */
export function getFallbackProfileDir(startIndex = 1, excludedDirs = []) {
  const profilesRootDir = path.resolve(process.cwd(), '.cache/profiles');
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
