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
export async function getCachedFingerprints(tags = []) {
  const cacheDir = getFingerprintCacheDir(tags);
  try {
    if (!fs.existsSync(cacheDir)) {
      return [];
    }

    const files = fs.readdirSync(cacheDir);
    if (files.length === 0) {
      return [];
    }

    const fingerprintFiles = files.map((file) => {
      const filePath = path.join(cacheDir, file);
      const stats = fs.statSync(filePath);
      return { path: filePath, mtime: stats.mtimeMs };
    });

    // Sort by modification time (newest first)
    fingerprintFiles.sort((a, b) => b.mtime - a.mtime);
    return fingerprintFiles.map((f) => f.path);
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
  const cachedFiles = await getCachedFingerprints(tags);
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
  const cachedFiles = await getCachedFingerprints(tags);
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
