'use strict';

var path = require('path');
var sbgUtility = require('sbg-utility');
var fs = require('fs');
require('playwright-extra');
var puppeteer = require('puppeteer-extra');
var StealthPlugin = require('puppeteer-extra-plugin-stealth');
var url = require('url');
var CryptoJS = require('crypto-js');
require('bluebird');
var fs$1 = require('fs-extra');
require('child_process');
var puppeteer$1 = require('puppeteer');
var path$1 = require('upath');

var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
var _puppeteerrc = {exports: {}};

var hasRequired_puppeteerrc;

function require_puppeteerrc () {
	if (hasRequired_puppeteerrc) return _puppeteerrc.exports;
	hasRequired_puppeteerrc = 1;
	const path$1 = path;
	const fs$1 = fs;

	/**
	 * @type {import("puppeteer").Configuration}
	 */
	const config = {
	  // Cache location for Puppeteer.
	  cacheDirectory: path$1.join(process.cwd(), '.cache', 'puppeteer'),
	  // Download Chrome (default `skipDownload: false`).
	  chrome: {
	    skipDownload: true
	  },
	  // Download Firefox (default `skipDownload: true`).
	  firefox: {
	    skipDownload: true
	  },
	  temporaryDirectory: path$1.join(process.cwd(), 'tmp/puppeteer')
	};

	fs$1.mkdirSync(config.cacheDirectory, { recursive: true });
	fs$1.mkdirSync(config.temporaryDirectory, { recursive: true });

	_puppeteerrc.exports = config;
	_puppeteerrc.exports.default = config;
	_puppeteerrc.exports.puppeteerConfig = config;
	_puppeteerrc.exports.puppeteerTempPath = config.temporaryDirectory;
	return _puppeteerrc.exports;
}

var _puppeteerrcExports = require_puppeteerrc();

function md5(str) {
  return CryptoJS.MD5(String(str)).toString(CryptoJS.enc.Hex);
}

/**
 * Convert a value to a number when possible.
 *
 * @param {number|string|null|undefined} value - Value to convert. Strings may include non-numeric characters (they will be stripped).
 * @returns {number|null} The parsed number, or `null` if conversion is not possible.
 */
function toNumber(value) {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const cleanedValue = value.replace(/[^0-9.-]+/g, '');
    const parsedValue = parseFloat(cleanedValue);
    return isNaN(parsedValue) ? null : parsedValue;
  }
  return null;
}

/**
 * Options for filtering fingerprints by screen size.
 * @typedef {Object} FingerprintSizeOptions
 * @property {number|string} [width] Exact width to match
 * @property {number|string} [height] Exact height to match
 * @property {number|string} [minWidth] Minimum width (inclusive)
 * @property {number|string} [minHeight] Minimum height (inclusive)
 * @property {number|string} [maxWidth] Maximum width (inclusive)
 * @property {number|string} [maxHeight] Maximum height (inclusive)
 */

/**
 * Get the fingerprint cache directory based on tags.
 *
 * @param {string[]} [tags] - Tags to include in the cache path
 * @returns {string} Fingerprint cache directory path
 */
function getFingerprintCacheDir(tags = []) {
  const baseCacheDir = path.join(process.cwd(), '.cache/fingerprints');
  if (!Array.isArray(tags) || tags.length === 0) {
    return baseCacheDir;
  }
  return path.join(baseCacheDir, ...tags);
}

/**
 * Extract numeric width/height from a parsed fingerprint object using parseScreenSize.
 * @param {object} parsedObj - Parsed fingerprint object
 * @returns {{width:number|null,height:number|null}}
 */
function getFingerprintDimensions(parsedObj) {
  const screenData = parseScreenSize(parsedObj);
  const w = toNumber(screenData?.screen?.width ?? screenData?.real?.width ?? screenData?.css?.deviceWidth);
  const h = toNumber(screenData?.screen?.height ?? screenData?.real?.height ?? screenData?.css?.deviceHeight);
  const viewportW = toNumber(screenData?.viewport?.width);
  const viewportH = toNumber(screenData?.viewport?.height);
  const availW = toNumber(screenData?.available?.width);
  const availH = toNumber(screenData?.available?.height);

  return {
    width: w ?? null,
    height: h ?? null,
    viewportWidth: viewportW ?? null,
    viewportHeight: viewportH ?? null,
    availableWidth: availW ?? null,
    availableHeight: availH ?? null
  };
}

/**
 * Check whether a parsed fingerprint object matches provided size constraints.
 * @param {object} parsedObj
 * @param {object} sizeOptions
 * @returns {boolean}
 */
function fingerprintMatchesSize(parsedObj, sizeOptions) {
  const dims = getFingerprintDimensions(parsedObj);
  const w = dims.width;
  const h = dims.height;
  const vpW = dims.viewportWidth;
  const vpH = dims.viewportHeight;
  const avW = dims.availableWidth;
  const avH = dims.availableHeight;

  // If we can't determine any useful dimensions, reject
  if (w == null && h == null && vpW == null && vpH == null) return false;

  if (sizeOptions.width != null) {
    const target = toNumber(sizeOptions.width);
    if ((w != null && w !== target) || (vpW != null && vpW !== target)) return false;
  }
  if (sizeOptions.height != null) {
    const target = toNumber(sizeOptions.height);
    if ((h != null && h !== target) || (vpH != null && vpH !== target)) return false;
  }

  if (sizeOptions.minWidth != null) {
    const min = toNumber(sizeOptions.minWidth);
    if ((w != null && w < min) || (vpW != null && vpW < min) || (avW != null && avW < min)) return false;
  }
  if (sizeOptions.minHeight != null) {
    const min = toNumber(sizeOptions.minHeight);
    if ((h != null && h < min) || (vpH != null && vpH < min) || (avH != null && avH < min)) return false;
  }

  if (sizeOptions.maxWidth != null) {
    const max = toNumber(sizeOptions.maxWidth);
    if ((w != null && w > max) || (vpW != null && vpW > max) || (avW != null && avW > max)) return false;
  }
  if (sizeOptions.maxHeight != null) {
    const max = toNumber(sizeOptions.maxHeight);
    if ((h != null && h > max) || (vpH != null && vpH > max) || (avH != null && avH > max)) return false;
  }

  return true;
}

/**
 * Get all cached fingerprints from the cache directory based on tags.
 * Optionally filter cached fingerprints by screen size constraints.
 *
 * @param {string[]} [tags] - Tags to determine cache directory
 * @param {FingerprintSizeOptions} [sizeOptions] - Optional size constraints (see typedef above)
 * @returns {Promise<string[]>} Array of cached fingerprint file paths, sorted by modification time (newest first)
 */
async function listCachedFingerprintFiles(tags = [], sizeOptions = {}) {
  const cacheDir = getFingerprintCacheDir(tags);
  try {
    if (!fs.existsSync(cacheDir)) {
      return [];
    }

    const collected = [];

    const shouldRecurse = !Array.isArray(tags) || tags.length === 0;

    const collectFiles = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        const fullPath = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          if (shouldRecurse) {
            collectFiles(fullPath);
          }
          continue;
        }
        if (ent.isFile()) {
          try {
            const stats = fs.statSync(fullPath);
            collected.push({ path: fullPath, mtime: stats.mtimeMs });
          } catch (e) {
            // ignore entries we can't stat
          }
        }
      }
    };

    collectFiles(cacheDir);

    if (collected.length === 0) {
      return [];
    }

    // Sort by modification time (newest first)
    collected.sort((a, b) => b.mtime - a.mtime);
    const paths = collected.map((f) => f.path);

    const isEmptyOptions = !sizeOptions || Object.keys(sizeOptions).length === 0;
    if (isEmptyOptions) {
      return paths;
    }

    const filtered = [];
    for (const filePath of paths) {
      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        let obj = null;
        try {
          obj = JSON.parse(content);
        } catch (e) {
          continue;
        }
        if (fingerprintMatchesSize(obj, sizeOptions)) {
          filtered.push(filePath);
        }
      } catch (e) {
        continue;
      }
    }

    return filtered;
  } catch (error) {
    console.warn(`Failed to list cached fingerprints: ${error.message}`);
    return [];
  }
}

/**
 * Get a random cached fingerprint from the cache directory.
 * Optionally filter cached fingerprints by screen size constraints.
 *
 * @param {string[]} [tags] - Tags to determine cache directory
 * @param {FingerprintSizeOptions} [sizeOptions] - Optional size constraints (see typedef above)
 * @returns {Promise<string|null>} Random cached fingerprint content, or null if none found
 */
async function getRandomCachedFingerprint(tags = [], sizeOptions = {}) {
  // Delegate file filtering to listCachedFingerprintFiles which supports sizeOptions.
  const cachedFiles = await listCachedFingerprintFiles(tags, sizeOptions);
  if (cachedFiles.length === 0) {
    return null;
  }
  // Choose a random file from the (already-filtered) list
  const randomIndex = Math.floor(Math.random() * cachedFiles.length);
  const randomFile = cachedFiles[randomIndex];
  try {
    return fs.readFileSync(randomFile, 'utf-8');
  } catch (error) {
    console.warn(`Failed to read cached fingerprint: ${error.message}`);
    return null;
  }
}

/**
 * Get the most recently cached fingerprint from the cache directory.
 * Optionally filter by screen size constraints.
 *
 * @param {string[]} [tags] - Tags to determine cache directory
 * @param {FingerprintSizeOptions} [sizeOptions] - Optional size constraints (see typedef above)
 * @returns {Promise<string|null>} Most recent cached fingerprint content, or null if cache is empty
 */
async function getLatestCachedFingerprint(tags = [], sizeOptions = {}) {
  const cachedFiles = await listCachedFingerprintFiles(tags, sizeOptions);
  if (cachedFiles.length === 0) {
    return null;
  }

  try {
    return fs.readFileSync(cachedFiles[0], 'utf-8');
  } catch (error) {
    console.warn(`Failed to read cached fingerprint: ${error.message}`);
    return null;
  }
}

/**
 * Save fingerprint content into the cache directory.
 *
 * @param {string} fingerprint - Raw fingerprint JSON string.
 * @param {string[]} [tags] - Tags used to determine cache directory.
 * @returns {string} Saved fingerprint file path.
 */
function saveFingerprintToCache(fingerprint, tags = []) {
  const filename = `${md5(fingerprint)}.json`;
  const fingerprintCacheDir = getFingerprintCacheDir(tags);
  const fingerprintCacheFilePath = path.join(fingerprintCacheDir, filename);
  sbgUtility.writefile(fingerprintCacheFilePath, fingerprint);
  return fingerprintCacheFilePath;
}

/**
 * Fetch a new fingerprint and save it into the cache directory.
 *
 * @param {string[]|import('puppeteer-with-fingerprints').FetchOptions} [tagsOrOption] - Tags used when fetching and storing fingerprint.
 * @returns {Promise<{ fingerprint: string, filePath: string | null } | null>} Fetched fingerprint and cache path, or null on failure.
 */
async function fetchAndSaveFingerprintToCache(tagsOrOption = []) {
  const normalizedTags = Array.isArray(tagsOrOption)
    ? tagsOrOption
    : typeof tagsOrOption === 'object' && Array.isArray(tagsOrOption.tags)
      ? tagsOrOption.tags
      : [];

  try {
    const fingerprintPlugin = await import('puppeteer-with-fingerprints').then((mod) => {
      mod.plugin.setServiceKey('');
      return mod.plugin;
    });

    /** @type {import('puppeteer-with-fingerprints').FetchOptions} */
    const optionsFp = typeof tagsOrOption === 'object' && !Array.isArray(tagsOrOption) ? tagsOrOption : {};
    if (normalizedTags.length > 0) {
      optionsFp.tags = normalizedTags;
    }
    const fingerprint = await fingerprintPlugin.fetch(optionsFp);
    const fingerprintObj = JSON.parse(fingerprint);
    // if (!fingerprintObj.valid) {
    //   console.warn('Fetched fingerprint is invalid:', fingerprintObj);
    // }

    if (!fingerprint || typeof fingerprint !== 'string') {
      console.warn('Failed to fetch a valid fingerprint');
      return null;
    }

    const filePath = fingerprintObj.valid ? saveFingerprintToCache(fingerprint, normalizedTags) : null;
    return { fingerprint, filePath };
  } catch (error) {
    console.warn(`Failed to fetch and cache fingerprint: ${error.message}`);
    return null;
  }
}

/**
 * Parse screen size information.
 * Accepts either a data object, a file path to a JSON file, or a JSON string.
 * If a file path is provided, the file will be read and parsed before processing.
 *
 * @param {object|string} data - Data object, JSON string, or filesystem path to JSON file
 * @returns {object|null} Parsed screen size info or null on failure
 */
function parseScreenSize(data) {
  // If `data` is a string, treat it as either a path to a JSON file or a JSON string.
  if (typeof data === 'string') {
    try {
      if (fs.existsSync(data)) {
        const content = fs.readFileSync(data, 'utf8');
        data = JSON.parse(content);
      } else {
        // Try parsing as raw JSON string
        data = JSON.parse(data);
      }
    } catch (err) {
      console.warn(`Failed to load/parse screen size data from "${data}": ${err.message}`);
      return null;
    }
  }

  const safe = (fn) => {
    try {
      return fn();
    } catch {
      return undefined;
    }
  };

  const screenWidth = safe(() => data.attr['screen.width']);
  const screenHeight = safe(() => data.attr['screen.height']);

  const cssDeviceWidth = safe(() => data.css['device-width']);
  const cssDeviceHeight = safe(() => data.css['device-height']);

  return {
    // ✅ Real device resolution (best effort)
    real: {
      width: screenWidth ?? cssDeviceWidth,
      height: screenHeight ?? cssDeviceHeight
    },

    // Viewport (browser visible area)
    viewport: {
      width: data.width,
      height: data.height
    },

    // Full screen resolution
    screen: {
      width: screenWidth,
      height: screenHeight
    },

    // Available screen (minus taskbar, etc.)
    available: {
      width: safe(() => data.attr['screen.availWidth']),
      height: safe(() => data.attr['screen.availHeight'])
    },

    // CSS / media query values
    css: {
      width: safe(() => data.css.width),
      height: safe(() => data.css.height),
      deviceWidth: cssDeviceWidth,
      deviceHeight: cssDeviceHeight
    }
  };
}

/**
 * Returns the first available fallback profile directory path.
 *
 * @param {number} [startIndex=1] - First profile index to probe.
 * @param {string[]} [excludedDirs=[]] - Directories to skip when selecting fallback profile.
 * @returns {string}
 */
function getFallbackProfileDir(startIndex = 1, excludedDirs = []) {
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

class Cookies {
  constructor(id = 'default', profileDir = path.resolve(process.cwd(), 'profiles')) {
    this.id = id;
    this.profileDir = profileDir;
  }

  getFilePath() {
    // If id is an absolute path, use it directly (with or without .json extension)
    if (path.isAbsolute(this.id)) {
      if (this.id.endsWith('.json')) {
        return this.id;
      }
      return `${this.id}_cookies.json`;
    }
    return path.join(this.profileDir, `${this.id}_cookies.json`);
  }

  /**
   * Load cookies into Puppeteer page
   * @param {import('puppeteer').Page} page
   * @param {object} options
   * @returns {Promise<boolean>}
   */
  async load(page, options = {}) {
    const { ignoreErrors = true } = options;

    const filePath = this.getFilePath();

    if (!(await fs$1.pathExists(filePath))) {
      return false;
    }

    try {
      const cookies = await fs$1.readJSON(filePath);

      if (!Array.isArray(cookies) || cookies.length === 0) {
        return false;
      }

      await page.setCookie(...cookies);
      return true;
    } catch (err) {
      if (!ignoreErrors) throw err;
      console.warn(`Failed to load cookies (${filePath}):`, err.message);
      return false;
    }
  }

  /**
   * Save cookies from Puppeteer page
   * @param {import('puppeteer').Page} page
   * @param {object} options
   * @returns {Promise<string>} file path
   */
  async save(page, options = {}) {
    const { filter = null, spaces = 2 } = options;

    const filePath = this.getFilePath();

    await fs$1.ensureDir(this.profileDir);

    let cookies = await page.cookies();

    if (typeof filter === 'function') {
      cookies = cookies.filter(filter);
    }

    await fs$1.writeJSON(filePath, cookies, { spaces });

    return filePath;
  }

  /**
   * Clear cookies file
   * @returns {Promise<boolean>}
   */
  async clear() {
    const filePath = this.getFilePath();

    if (await fs$1.pathExists(filePath)) {
      await fs$1.remove(filePath);
      return true;
    }

    return false;
  }

  /**
   * Read cookies data from file (no page interaction)
   * @returns {Promise<Array|false>} cookies array or false if not found/invalid
   */
  async read() {
    const filePath = this.getFilePath();
    if (!(await fs$1.pathExists(filePath))) {
      return false;
    }
    try {
      const cookies = await fs$1.readJSON(filePath);
      if (!Array.isArray(cookies) || cookies.length === 0) {
        return false;
      }
      return cookies;
    } catch (err) {
      console.warn(`Failed to read cookies (${filePath}):`, err.message);
      return false;
    }
  }
}

/**
 * Navigate a Puppeteer `page` to `url` with retries and exponential backoff.
 * @param {import('puppeteer').Page} page
 * @param {string} url
 * @param {object} [opts]
 * @param {number} [opts.retries=3] - Number of retry attempts (not counting the first try).
 * @param {number} [opts.timeout=30000] - Navigation timeout in ms.
 * @param {string|string[]} [opts.waitUntil='networkidle2'] - Puppeteer waitUntil option.
 * @param {import('./Cookies.js').PuppeteerCookies} [opts.cookie] - Optional PuppeteerCookies instance to load cookies before navigation.
 * @param {number} [opts.retryDelay=1000] - Initial delay in ms between retries (exponential backoff).
 * @param {function} [opts.onRetry] - Optional callback called before each retry with {attempt, err, delay}.
 * @returns {Promise<import('puppeteer').HTTPResponse|null>}
 */
async function goWithRetry(page, url, opts = {}) {
  const { retries = 3, timeout = 30000, waitUntil = 'networkidle2', retryDelay = 1000, onRetry, cookie } = opts;

  let lastErr = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (cookie) {
        // ✅ IMPORTANT: open domain first
        await page.goto(url, { waitUntil: 'domcontentloaded' });

        // ✅ load cookies AFTER initial navigation
        const loaded = await cookie.load(page);
        console.log('[cookies] loaded:', loaded);

        // ✅ apply cookies properly
        if (loaded) {
          await page.reload({ waitUntil: 'domcontentloaded' });
        }
      }
      const response = await page.goto(url, { timeout, waitUntil });
      if (cookie && response.ok()) {
        // ✅ Save cookies after page is fully loaded
        await cookie.save(page);
      }
      return response;
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      const delay = Math.round(retryDelay * Math.pow(2, attempt));
      if (typeof onRetry === 'function') {
        try {
          // Support sync and async callbacks. If onRetry returns a Promise,
          // awaiting Promise.resolve will handle both cases.
          await Promise.resolve(onRetry({ attempt, err, delay }));
        } catch {
          // swallow callback errors
        }
      }
      await new Promise((res) => setTimeout(res, delay));
    }
  }

  throw lastErr;
}

/**
 * Get the absolute path of the current script.
 * @constant {string} __filename - The file path of the current module.
 * @constant {string} __dirname - The directory path of the current module.
 */
const __filename$1 = url.fileURLToPath((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('launcher.cjs', document.baseURI).href)));
path.dirname(__filename$1);

/**
 * The absolute path for the user data directory.
 * @constant {string} userDataDir - The path to store browser profile data.
 */
const userDataDir = path.resolve(process.cwd(), '.cache/profiles/profile1');

/**
 * @type {import('puppeteer').Browser | null}
 */
let puppeteer_browser = null;

/**
 * Checks whether a Chromium user data directory appears to be in use.
 *
 * @param {string} targetUserDataDir - User data directory path to check.
 * @returns {boolean}
 */
function isUserDataDirInUse(targetUserDataDir) {
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
// `getFallbackProfileDir` is re-exported from `src/puppeteer/getFallbackProfileDir.js`

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
 * @param {Object} params.launchOptions
 * @param {boolean} params.autoSwitchProfileDir
 * @returns {{ currentLaunchOptions: Object, excludedUserDataDirs: Set<string> }}
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
 * @param {(launchOptions: Object) => Promise<any>} params.launchFn
 * @param {Object} params.launchOptions
 * @param {boolean} params.autoSwitchProfileDir
 * @param {string} params.launcherName
 * @param {number} [params.maxFallbackLaunchAttempts=10]
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
 * Launches or reuses a Puppeteer browser instance using `puppeteer-extra` with optional stealth plugin.
 *
 * @async
 * @function getPuppeteer
 * @param {import('./puppeteer_utils-d.d.ts').getPuppeteerOptions} [options] - Configuration options for launching Puppeteer.
 * @returns {Promise<import('./puppeteer_utils-d.d.ts').GetPuppeteerSingleReturn>} Resolves with `page`, `browser`, and `puppeteer`.
 *
 * @example
 * const { page, browser } = await getPuppeteer({ headless: true });
 * await page.goto('https://example.com');
 * // ...
 * await browser.close();
 *
 * @example
 * // Use random cached fingerprint or fetch new one if cache is empty
 * const { page, browser } = await getPuppeteer({
 *   stealth: {
 *     mode: 'fingerprint',
 *     fingerprintStrategy: 'random-or-fetch'
 *   }
 * });
 */
async function getPuppeteer(options = {}) {
  /** @type {import('./puppeteer_utils-d.d.ts').getPuppeteerOptions} */
  const defaultOptions = {
    headless: false,
    userDataDir: userDataDir,
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    args: [
      '--start-maximized',
      '--disable-features=HeavyAdIntervention',
      '--disable-features=AdInterestGroupAPI',
      '--disable-popup-blocking',
      '--no-default-browser-check',
      '--no-first-run',
      '--ignore-certificate-errors',
      '--hide-crash-restore-bubble',
      '--autoplay-policy=no-user-gesture-required',
      '--disable-infobars',
      '--disable-blink-features=AutomationControlled'
    ],
    // Remove Puppeteer's automation switch to avoid the "controlled by automated software" infobar
    ignoreDefaultArgs: ['--enable-automation'],
    reuse: true,
    autoSwitchProfileDir: true,
    devtools: false,
    stealth: {
      mode: 'default',
      fingerprintStrategy: 'fetch',
      fingerprintTags: ['Microsoft Windows', 'Chrome']
    }
  };
  const merged = { ...defaultOptions, ...options };
  const { autoSwitchProfileDir, stealth, ...launchOptions } = merged;

  const stealthMode = stealth?.mode ?? 'default';
  const fingerprintStrategy = stealth?.fingerprintStrategy ?? 'fetch';
  const fingerprintTags = stealth?.fingerprintTags ?? ['Microsoft Windows', 'Chrome'];
  const fingerprintScreenSize = stealth?.screenSize ?? undefined;

  /** @type {import('puppeteer')} */
  let puppeteer_module = puppeteer;

  /** @type {string | null} */
  let fingerprint = null;

  // Prepare stealth plugin based on options
  if (stealthMode === 'stealth' || stealthMode === 'default') {
    puppeteer_module.use(StealthPlugin());
  } else if (stealthMode === 'fingerprint') {
    const fingerprintPlugin = await import('puppeteer-with-fingerprints').then((mod) => {
      mod.plugin.setServiceKey('');
      return mod.plugin;
    });

    // Determine fingerprint strategy
    if (fingerprintStrategy === 'random-cached') {
      fingerprint = await getRandomCachedFingerprint(fingerprintTags, fingerprintScreenSize);
      if (!fingerprint) {
        console.warn('No cached fingerprints available, fetching new one');
        const fetched = await fetchAndSaveFingerprintToCache({
          tags: fingerprintTags,
          ...(fingerprintScreenSize || {})
        });
        fingerprint = fetched?.fingerprint ?? null;
      }
    } else if (fingerprintStrategy === 'latest-cached') {
      fingerprint = await getLatestCachedFingerprint(fingerprintTags, fingerprintScreenSize);
      if (!fingerprint) {
        console.warn('No cached fingerprints available, fetching new one');
        const fetched = await fetchAndSaveFingerprintToCache({
          tags: fingerprintTags,
          ...(fingerprintScreenSize || {})
        });
        fingerprint = fetched?.fingerprint ?? null;
      }
    } else if (fingerprintStrategy === 'random-or-fetch') {
      fingerprint = await getRandomCachedFingerprint(fingerprintTags, fingerprintScreenSize);
      if (!fingerprint) {
        console.log('Cache empty, fetching new fingerprint');
        const fetched = await fetchAndSaveFingerprintToCache({
          tags: fingerprintTags,
          ...(fingerprintScreenSize || {})
        });
        fingerprint = fetched?.fingerprint ?? null;
      }
    } else {
      const fetched = await fetchAndSaveFingerprintToCache({ tags: fingerprintTags, ...(fingerprintScreenSize || {}) });
      fingerprint = fetched?.fingerprint ?? null;
    }

    if (sbgUtility.isEmpty(fingerprint)) {
      throw new Error('Failed to obtain a valid fingerprint using strategy: ' + fingerprintStrategy);
    }

    // When fingerprint was fetched via `fetchAndSaveFingerprintToCache` it is already cached.

    fingerprintPlugin.useFingerprint(fingerprint);
    puppeteer_module = fingerprintPlugin;
  }

  let actualProfileDir = merged.userDataDir;
  if (!puppeteer_browser || !puppeteer_browser.connected || !merged.reuse) {
    // If a remote browser WebSocket endpoint is provided, connect instead of launching.
    if (launchOptions.browserWSEndpoint) {
      try {
        puppeteer_browser = await puppeteer.connect({ browserWSEndpoint: launchOptions.browserWSEndpoint });
        const page = await puppeteer_browser.newPage();
        return { page, browser: puppeteer_browser, puppeteer };
      } catch (err) {
        console.warn('Failed to connect to provided browserWSEndpoint, falling back to launch:', err?.message || err);
        // fall through to launch path
      }
    }
    if (launchOptions.executablePath && !fs.existsSync(launchOptions.executablePath)) {
      launchOptions.executablePath = undefined; // Use Puppeteer's default Chromium
    }

    let usedProfileDir = merged.userDataDir;
    puppeteer_browser = await launchWithProfileFallback({
      launchFn: async (currentLaunchOptions) => {
        usedProfileDir = currentLaunchOptions.userDataDir;
        if (stealthMode === 'fingerprint') {
          const clonedArgs = [...currentLaunchOptions.args];
          // remove --user-data-dir from args to avoid conflicts with fingerprint profile management
          // remove --start-maximized from args for fingerprint mode
          const filteredArgs = clonedArgs.filter(
            (arg) => !arg.startsWith('--user-data-dir=') && arg !== '--start-maximized'
          );
          const args = [
            ...filteredArgs,
            '--disable-features=HeavyAdIntervention', // Disable Chrome's blocking of intrusive ads
            '--disable-features=AdInterestGroupAPI', // Prevents blocking based on ad interest group
            '--disable-popup-blocking', // Disable pop-up blocking
            '--no-default-browser-check',
            '--no-first-run',
            '--ignore-certificate-errors',
            '--hide-crash-restore-bubble',
            '--autoplay-policy=no-user-gesture-required',
            // Use a subdirectory for fingerprint profile to avoid conflicts
            '--user-data-dir=' + path.join(currentLaunchOptions.userDataDir, 'browser-with-fingerprints')
          ];

          const fingerprintObj = JSON.parse(fingerprint);
          if (fingerprintObj.ua) args.push('--user-agent=' + fingerprintObj.ua);
          if (fingerprintObj.lang) args.push('--lang=' + fingerprintObj.lang);
          return await puppeteer_module.launch({
            args: sbgUtility.array_unique(args),
            headless: currentLaunchOptions.headless,
            devtools: currentLaunchOptions.devtools
          });
        }

        return await puppeteer.launch(currentLaunchOptions);
      },
      launchOptions,
      autoSwitchProfileDir,
      launcherName: 'Puppeteer'
    });
    actualProfileDir = usedProfileDir;
  }

  const page = await puppeteer_browser.newPage();
  const cookie = new Cookies(actualProfileDir);
  // goto can be called as (url, options) or (page, url, options)
  const goto = (pageOrUrl, url, options) => {
    if (typeof pageOrUrl === 'string') {
      // (url, options)
      return goWithRetry(page, pageOrUrl, { ...url, cookie });
    } else {
      // (page, url, options)
      return goWithRetry(pageOrUrl, url, { ...options, cookie });
    }
  };
  return {
    page,
    browser: puppeteer_browser,
    puppeteer: puppeteer_module,
    profileDir: actualProfileDir,
    cookie,
    goto,
    navigate: goto
  };
}

// re-exported above from src/puppeteer/*

/**
 * Closes tabs (pages) in the browser context while preserving a given set or count of pages.
 *
 * If `instance` is a `Page`, its browser is used to list pages. If `instance` is a `Browser`,
 * its pages are used directly.
 *
 * The `keepCount` parameter supports two modes:
 * - number (legacy): keep that many most-recently opened/active pages (the newest N pages).
 * - array or `Set` of `Page` objects: explicitly preserve exactly those pages; all other pages
 *   will be closed. If a `Page` was passed as `instance` and `keepCount` is an array/Set, that
 *   page will be included among the protected pages.
 *
 * @param {import('puppeteer').Page|import('puppeteer').Browser} instance - The Puppeteer Page or Browser instance.
 *   If a Page is provided, its browser will be used to get all pages. If a Browser is provided, its pages will be used directly.
 * @param {number|import('puppeteer').Page[]|Set<import('puppeteer').Page>} [keepCount=2] - Number of pages to keep (legacy),
 *   or an array/Set of Page objects to explicitly protect.
 * @returns {Promise<void>}
 */
async function closeOtherTabs(instance, keepCount = 2) {
  // Accept either a Page or Browser instance
  let currentPage = null;
  let browser = null;

  if (instance && typeof instance.browser === 'function') {
    currentPage = instance; // instance is a Page
    browser = instance.browser();
  } else if (instance && typeof instance.pages === 'function') {
    browser = instance; // instance is a Browser
  } else {
    throw new Error('Instance must be a Puppeteer Page or Browser');
  }

  // If keepCount is an array/Set, preserve those pages (and currentPage if present)
  if (Array.isArray(keepCount) || keepCount instanceof Set) {
    const protectedPages = new Set();
    for (const p of keepCount) {
      if (p) protectedPages.add(p);
    }
    if (currentPage) protectedPages.add(currentPage);

    const pages = await browser.pages();
    if (pages.length <= protectedPages.size) return; // nothing to close

    const pagesToClose = pages.filter((page) => !protectedPages.has(page));
    for (const page of pagesToClose) {
      try {
        if (typeof page?.isClosed === 'function' && page.isClosed()) continue;
        await page.close();
      } catch (error) {
        const errorMessage = String(error?.message || error || '').toLowerCase();
        if (
          errorMessage.includes('no target with given id found') ||
          errorMessage.includes('target closed') ||
          errorMessage.includes('session closed')
        ) {
          continue;
        }
        throw error;
      }
    }

    return;
  }

  // Numeric keepCount: match closeExtraPages logic — repeatedly close the oldest page
  const keepNum = Math.max(0, Number(keepCount) || 2);
  // Close oldest pages until we have at most keepNum pages left
  while ((await browser.pages()).length > keepNum) {
    const pagesNow = (await browser.pages()).filter((p) => p);
    if (pagesNow.length === 0) break;
    try {
      const pageToClose = pagesNow[0];
      if (typeof pageToClose?.isClosed === 'function' && pageToClose.isClosed()) continue;
      await pageToClose.close();
    } catch (error) {
      const errorMessage = String(error?.message || error || '').toLowerCase();
      if (
        errorMessage.includes('no target with given id found') ||
        errorMessage.includes('target closed') ||
        errorMessage.includes('session closed')
      ) {
        continue;
      }
      throw error;
    }
  }
}

class EndpointManager {
    constructor(basePath) {
        this.basePath = basePath;
        this.endpointFile = path$1.join(this.basePath, 'endpoint.json');
        this.endpointLocksPath = path$1.join(this.basePath, 'endpoint-locks');
        fs$1.ensureDirSync(this.basePath);
        fs$1.ensureDirSync(this.endpointLocksPath);
    }
    parseEndpoints(content) {
        if (!content)
            return [];
        return sbgUtility.jsonParseWithCircularRefs(content);
    }
    getEndpointLockPath(endpoint) {
        return path$1.join(this.endpointLocksPath, `${encodeURIComponent(endpoint)}.json`);
    }
    readEndpointLock(endpoint) {
        const lockPath = this.getEndpointLockPath(endpoint);
        try {
            const content = fs$1.readFileSync(lockPath, 'utf8').trim();
            if (!content)
                return undefined;
            return sbgUtility.jsonParseWithCircularRefs(content);
        }
        catch {
            return undefined;
        }
    }
    isProcessRunning(pid) {
        try {
            // signal 0 does not kill the process, only tests for existence
            process.kill(pid, 0);
            return true;
        }
        catch {
            return false;
        }
    }
    getActiveEndpointLock(endpoint) {
        const lockPath = this.getEndpointLockPath(endpoint);
        const lock = this.readEndpointLock(endpoint);
        if (!(lock === null || lock === void 0 ? void 0 : lock.ownerPid)) {
            fs$1.removeSync(lockPath);
            return undefined;
        }
        if (!this.isProcessRunning(lock.ownerPid)) {
            fs$1.removeSync(lockPath);
            return undefined;
        }
        return lock;
    }
    isEndpointLocked(endpoint) {
        return Boolean(this.getActiveEndpointLock(endpoint));
    }
    readEndpoints() {
        try {
            const content = fs$1.readFileSync(this.endpointFile, 'utf8').trim();
            return this.parseEndpoints(content);
        }
        catch {
            return [];
        }
    }
    writeEndpoint(endpoint) {
        const endpoints = this.readEndpoints();
        const uniqueEndpoints = Array.from(new Set([...endpoints, endpoint]));
        sbgUtility.writefile(this.endpointFile, sbgUtility.jsonStringifyWithCircularRefs(uniqueEndpoints));
    }
    removeEndpoint(endpoint) {
        const endpoints = this.readEndpoints().filter((item) => item !== endpoint);
        sbgUtility.writefile(this.endpointFile, sbgUtility.jsonStringifyWithCircularRefs(endpoints));
        // remove any lock file
        const lockPath = this.getEndpointLockPath(endpoint);
        fs$1.removeSync(lockPath);
    }
    /**
     * Checks if a Puppeteer endpoint is available by attempting Puppeteer.connect.
     */
    async isPuppeteerEndpointAvailable(endpoint) {
        try {
            const browser = await puppeteer$1.connect({ browserWSEndpoint: endpoint });
            await browser.disconnect();
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * Returns the first available endpoint (not locked, not stale, and Puppeteer responds)
     */
    async getAvailableEndpoint() {
        const endpoints = this.readEndpoints();
        if (!endpoints.length)
            return undefined;
        for (const endpoint of endpoints) {
            const lock = this.readEndpointLock(endpoint);
            if (lock && this.isProcessRunning(lock.ownerPid))
                continue;
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
    async getAllActiveEndpoints() {
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
                }
                else {
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
    tryClaimEndpoint(endpoint, ownerPid) {
        fs$1.ensureDirSync(this.endpointLocksPath);
        const lockPath = this.getEndpointLockPath(endpoint);
        const existingLock = this.getActiveEndpointLock(endpoint);
        if ((existingLock === null || existingLock === void 0 ? void 0 : existingLock.ownerPid) && existingLock.ownerPid !== ownerPid) {
            return false;
        }
        const payload = {
            ownerPid,
            claimedAt: new Date().toISOString()
        };
        try {
            const fd = fs$1.openSync(lockPath, 'wx');
            fs$1.writeFileSync(fd, sbgUtility.jsonStringifyWithCircularRefs(payload));
            fs$1.closeSync(fd);
            return true;
        }
        catch (error) {
            if ((error === null || error === void 0 ? void 0 : error.code) === 'EEXIST')
                return false;
            throw error;
        }
    }
    releaseEndpointClaim(endpoint, ownerPid) {
        const lockPath = this.getEndpointLockPath(endpoint);
        const lock = this.readEndpointLock(endpoint);
        if (!(lock === null || lock === void 0 ? void 0 : lock.ownerPid)) {
            fs$1.removeSync(lockPath);
            return;
        }
        if (lock.ownerPid !== ownerPid && this.isProcessRunning(lock.ownerPid)) {
            return;
        }
        fs$1.removeSync(lockPath);
    }
    readEndpointStatus() {
        return this.readEndpoints().map((endpoint) => {
            const lock = this.getActiveEndpointLock(endpoint);
            return {
                endpoint,
                inUse: Boolean(lock),
                ownerPid: lock === null || lock === void 0 ? void 0 : lock.ownerPid
            };
        });
    }
}

path$1.dirname(url.fileURLToPath((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('launcher.cjs', document.baseURI).href))));
path$1.join(_puppeteerrcExports.puppeteerTempPath, 'launcher.log');
const endpointManager = new EndpointManager(_puppeteerrcExports.puppeteerTempPath);

/**
 * Launches a Puppeteer browser instance in the background for parallel usage.
 *
 * Opens a maximized browser with stealth mode enabled, navigates to the
 * initial URL, and sets up target lifecycle listeners (`targetcreated`,
 * `targetdestroyed`, `targetchanged`) that refresh the shared WebSocket
 * endpoint file whenever targets change.
 *
 * After the browser is ready the function:
 * - Writes the browser's WebSocket endpoint so other processes can connect
 * - Removes stale/unavailable endpoints from the registry
 * - Creates a PID-based running-indicator file under `puppeteerTempPath`
 *
 * The returned promise never resolves — it keeps the process alive until the
 * browser disconnects or the process receives `SIGINT`, `SIGTERM`, or `exit`,
 * at which point the endpoint is cleaned up.
 */
async function parallelLauncher() {
    const { browser, goto } = await getPuppeteer({
        args: ['--start-maximized', '--disable-features=site-per-process'],
        headless: false,
        devtools: false,
        userDataDir,
        reuse: false,
        autoSwitchProfileDir: true,
        stealth: {
            mode: 'stealth'
        }
    });
    await goto('http://sh.webmanajemen.com', { timeout: 10000, waitUntil: 'networkidle2' });
    await closeOtherTabs(browser, 1);
    // Detect when new targets (pages, workers, etc.) are created/destroyed/changed.
    browser.on('targetcreated', async (target) => {
        try {
            console.log('Target created:', target.type(), target.url());
            if (target.type() === 'page') {
                const pageFromTarget = await target.page();
                if (pageFromTarget)
                    console.log('New page target URL:', pageFromTarget.url());
            }
        }
        catch (err) {
            console.error('Error handling targetcreated:', err);
        }
        // refresh endpoint file when targets change
        try {
            endpointManager.writeEndpoint(browser.wsEndpoint());
        }
        catch (e) {
            console.error('Failed to refresh endpoint on targetcreated:', e);
        }
    });
    browser.on('targetdestroyed', (target) => {
        try {
            console.log('Target destroyed:', target.type(), target.url());
        }
        catch (err) {
            console.error('Error handling targetdestroyed:', err);
        }
        try {
            endpointManager.writeEndpoint(browser.wsEndpoint());
        }
        catch (e) {
            console.error('Failed to refresh endpoint on targetdestroyed:', e);
        }
    });
    browser.on('targetchanged', (target) => {
        try {
            console.log('Target changed:', target.type(), target.url());
        }
        catch (err) {
            console.error('Error handling targetchanged:', err);
        }
        try {
            endpointManager.writeEndpoint(browser.wsEndpoint());
        }
        catch (e) {
            console.error('Failed to refresh endpoint on targetchanged:', e);
        }
    });
    // Write the WebSocket endpoint to a file for other processes to connect
    const wsEndpoint = browser.wsEndpoint();
    console.log('WebSocket Endpoint:', wsEndpoint);
    endpointManager.writeEndpoint(wsEndpoint);
    // Remove unavailable endpoints after registering the new one
    const endpoints = await endpointManager.getAllActiveEndpoints();
    for (const item of endpoints) {
        if (!item.puppeteerAvailable && item.endpoint !== wsEndpoint) {
            endpointManager.removeEndpoint(item.endpoint);
            console.log('Removed unavailable endpoint:', item.endpoint);
        }
    }
    // Write indicator file to signal that the browser is running
    const runningIndicatorPath = path.join(_puppeteerrcExports.puppeteerTempPath, 'browser-running', process.pid.toString());
    sbgUtility.writefile(runningIndicatorPath, 'Browser is running');
    console.log(`Browser running indicator created at: ${runningIndicatorPath}`);
    // Keep the process alive until the browser is closed
    await new Promise((resolve) => {
        browser === null || browser === void 0 ? void 0 : browser.on('disconnected', () => {
            endpointManager.removeEndpoint(wsEndpoint);
            resolve(true);
        });
        // Listen for process disconnects from clients (e.g., skrin.runner.ts)
        process.on('SIGINT', () => {
            endpointManager.removeEndpoint(wsEndpoint);
            console.log('SIGINT received, released endpoint:', wsEndpoint);
            resolve(true);
        });
        process.on('SIGTERM', () => {
            endpointManager.removeEndpoint(wsEndpoint);
            console.log('SIGTERM received, released endpoint:', wsEndpoint);
            resolve(true);
        });
        process.on('exit', () => {
            endpointManager.removeEndpoint(wsEndpoint);
            console.log('Process exit, released endpoint:', wsEndpoint);
            resolve(true);
        });
    });
}

parallelLauncher()
    .then(() => {
    console.log('Launcher process completed.');
    process.exit(0);
})
    .catch((err) => {
    console.error('Error in launcher process:', err);
    process.exit(1);
});
//# sourceMappingURL=launcher.cjs.map
