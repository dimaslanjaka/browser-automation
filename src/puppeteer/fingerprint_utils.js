import fs from 'fs';
import path from 'path';
import { md5, writefile } from 'sbg-utility';

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
 * Get all cached fingerprints from the cache directory based on tags.
 *
 * @param {string[]} [tags] - Tags to determine cache directory
 * @returns {Promise<string[]>} Array of cached fingerprint file paths, sorted by modification time (newest first)
 */
export async function listCachedFingerprintFiles(tags = []) {
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
    return collected.map((f) => f.path);
  } catch (error) {
    console.warn(`Failed to list cached fingerprints: ${error.message}`);
    return [];
  }
}

/**
 * Get a random cached fingerprint from the cache directory.
 *
 * @param {string[]} [tags] - Tags to determine cache directory
 * @returns {Promise<string | null>} Random cached fingerprint content, or null if cache is empty
 */
export async function getRandomCachedFingerprint(tags = []) {
  const cachedFiles = await listCachedFingerprintFiles(tags);
  if (cachedFiles.length === 0) {
    return null;
  }

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
 *
 * @param {string[]} [tags] - Tags to determine cache directory
 * @returns {Promise<string | null>} Most recent cached fingerprint content, or null if cache is empty
 */
export async function getLatestCachedFingerprint(tags = []) {
  const cachedFiles = await listCachedFingerprintFiles(tags);
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
