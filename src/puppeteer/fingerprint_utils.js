import fs from 'fs';
import path from 'path';

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
