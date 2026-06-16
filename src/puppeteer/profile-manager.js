import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Global shared temp directory for all puppeteer parallel data, using the
 * OS temp folder so that all processes (regardless of working directory)
 * share the same state.
 */
export const GLOBAL_PUPPETEER_DIR = path.join(os.tmpdir(), 'browser-automation-puppeteer');

/**
 * Global shared directory for browser profile data, using the OS temp folder so
 * that all processes (regardless of working directory) share the same profiles.
 */
export const GLOBAL_PROFILES_DIR = path.join(GLOBAL_PUPPETEER_DIR, 'profiles');

/**
 * Checks whether a Chromium user data directory appears to be in use.
 *
 * @param {string} targetUserDataDir - User data directory path to check.
 * @returns {boolean}
 */
export function isUserDataDirInUse(targetUserDataDir) {
  if (!targetUserDataDir) return false;

  const resolvedUserDataDir = path.resolve(targetUserDataDir);
  const lockFiles = ['SingletonLock', 'SingletonCookie', 'SingletonSocket', 'LOCK'];

  return lockFiles.some((fileName) => fs.existsSync(path.join(resolvedUserDataDir, fileName)));
}

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

  while (true) {
    const profileDir = path.join(profilesRootDir, `profile${index}`);
    if (!excludedDirSet.has(profileDir) && !isUserDataDirInUse(profileDir)) {
      return profileDir;
    }
    index += 1;
  }
}

/**
 * @param {unknown} error
 * @returns {boolean}
 */
function isProfileInUseLaunchError(error) {
  const errorMessage = String(error?.message || error || '').toLowerCase();
  return (
    errorMessage.includes('already running for') ||
    errorMessage.includes('userdatadir') ||
    errorMessage.includes('user data dir')
  );
}

/**
 * @param {Set<string>} excludedUserDataDirs
 * @param {number} [startIndex=1]
 * @returns {string}
 */
function reserveNextFallbackProfileDir(excludedUserDataDirs, startIndex = 1) {
  const fallbackUserDataDir = getFallbackProfileDir(startIndex, [...excludedUserDataDirs]);
  const resolvedFallbackUserDataDir = path.resolve(fallbackUserDataDir);
  fs.mkdirSync(resolvedFallbackUserDataDir, { recursive: true });
  excludedUserDataDirs.add(resolvedFallbackUserDataDir);
  return resolvedFallbackUserDataDir;
}

/**
 * @param {Object} params
 * @param {{ userDataDir?: string }} params.launchOptions - Puppeteer launch options object.
 * @param {boolean} params.autoSwitchProfileDir - Whether to fall back to another profile dir if preferred is busy.
 * @returns {{ currentLaunchOptions: { userDataDir?: string }, excludedUserDataDirs: Set<string> }}
 */
function prepareLaunchOptionsWithProfileFallback({ launchOptions, autoSwitchProfileDir }) {
  const launchUserDataDirPath = launchOptions.userDataDir ? path.resolve(launchOptions.userDataDir) : '';
  const excludedUserDataDirs = new Set();

  if (launchUserDataDirPath) {
    excludedUserDataDirs.add(launchUserDataDirPath);
  }

  const currentLaunchOptions = { ...launchOptions };
  if (autoSwitchProfileDir && isUserDataDirInUse(launchUserDataDirPath)) {
    const fallbackUserDataDir = reserveNextFallbackProfileDir(excludedUserDataDirs, 1);
    console.warn(`userDataDir is currently in use by another process, switching to profile: ${fallbackUserDataDir}`);
    currentLaunchOptions.userDataDir = fallbackUserDataDir;
  }

  return { currentLaunchOptions, excludedUserDataDirs };
}

/**
 * @param {Object} params
 * @param {(launchOptions: { userDataDir?: string }) => Promise<any>} params.launchFn - Function that performs the actual browser launch.
 * @param {{ userDataDir?: string }} params.launchOptions - Puppeteer launch options object.
 * @param {boolean} params.autoSwitchProfileDir - Whether to fall back to another profile dir if preferred is busy.
 * @param {string} params.launcherName - Name of the launcher (for logging).
 * @param {number} [params.maxFallbackLaunchAttempts=10] - Max retries if profile dir is in use.
 * @returns {Promise<any>}
 */
async function launchWithProfileFallback({
  launchFn,
  launchOptions,
  autoSwitchProfileDir,
  launcherName,
  maxFallbackLaunchAttempts = 10
}) {
  const { currentLaunchOptions: initialLaunchOptions, excludedUserDataDirs } = prepareLaunchOptionsWithProfileFallback({
    launchOptions,
    autoSwitchProfileDir
  });

  let launchAttempt = 0;
  let currentLaunchOptions = { ...initialLaunchOptions };

  while (true) {
    try {
      return await launchFn(currentLaunchOptions);
    } catch (error) {
      if (!autoSwitchProfileDir || !isProfileInUseLaunchError(error) || launchAttempt >= maxFallbackLaunchAttempts) {
        throw error;
      }

      if (currentLaunchOptions.userDataDir) {
        excludedUserDataDirs.add(path.resolve(currentLaunchOptions.userDataDir));
      }

      const fallbackUserDataDir = reserveNextFallbackProfileDir(excludedUserDataDirs, 1);
      launchAttempt += 1;

      console.warn(
        `${launcherName} launch failed because userDataDir is busy, retrying with profile: ${fallbackUserDataDir}`
      );

      currentLaunchOptions = {
        ...currentLaunchOptions,
        userDataDir: fallbackUserDataDir
      };
    }
  }
}

/**
 * @param {Object} params
 * @param {string} params.preferredUserDataDir
 * @param {Set<string>} params.reservedUserDataDirs
 * @param {boolean} params.autoSwitchProfileDir
 * @param {number} [params.fallbackProfileStartIndex=1]
 * @returns {string}
 */
function reserveClusterUserDataDir({
  preferredUserDataDir,
  reservedUserDataDirs,
  autoSwitchProfileDir,
  fallbackProfileStartIndex = 1
}) {
  const resolvedPreferredPath = preferredUserDataDir ? path.resolve(preferredUserDataDir) : '';

  if (!autoSwitchProfileDir) {
    if (resolvedPreferredPath) {
      reservedUserDataDirs.add(resolvedPreferredPath);
      return resolvedPreferredPath;
    }
    return resolvedPreferredPath;
  }

  if (
    resolvedPreferredPath &&
    !reservedUserDataDirs.has(resolvedPreferredPath) &&
    !isUserDataDirInUse(resolvedPreferredPath)
  ) {
    reservedUserDataDirs.add(resolvedPreferredPath);
    return resolvedPreferredPath;
  }

  return reserveNextFallbackProfileDir(reservedUserDataDirs, fallbackProfileStartIndex);
}

// Re-export internal functions for use by puppeteer_utils.js
export {
  prepareLaunchOptionsWithProfileFallback,
  reserveNextFallbackProfileDir,
  launchWithProfileFallback,
  reserveClusterUserDataDir
};
