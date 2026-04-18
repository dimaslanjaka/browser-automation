import fs from 'fs';
import path from 'path';
import { writefile } from 'sbg-utility';
import md5 from '../utils/md5.js';
import { toNumber } from '../utils/number.js';

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
export function getFingerprintCacheDir(tags = []) {
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
export async function listCachedFingerprintFiles(tags = [], sizeOptions = {}) {
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
export async function getRandomCachedFingerprint(tags = [], sizeOptions = {}) {
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
export async function getLatestCachedFingerprint(tags = [], sizeOptions = {}) {
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
export function saveFingerprintToCache(fingerprint, tags = []) {
  const filename = `${md5(fingerprint)}.json`;
  const fingerprintCacheDir = getFingerprintCacheDir(tags);
  const fingerprintCacheFilePath = path.join(fingerprintCacheDir, filename);
  writefile(fingerprintCacheFilePath, fingerprint);
  return fingerprintCacheFilePath;
}

/**
 * Fetch a new fingerprint and save it into the cache directory.
 *
 * @param {string[]|import('puppeteer-with-fingerprints').FetchOptions} [tagsOrOption] - Tags used when fetching and storing fingerprint.
 * @returns {Promise<{ fingerprint: string, filePath: string | null } | null>} Fetched fingerprint and cache path, or null on failure.
 */
export async function fetchAndSaveFingerprintToCache(tagsOrOption = []) {
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
export function parseScreenSize(data) {
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
