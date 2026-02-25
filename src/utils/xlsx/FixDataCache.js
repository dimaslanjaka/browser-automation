import fs from 'fs-extra';
import path from 'upath';

/**
 * Cache manager for fixData results.
 * Stores processed data by NIK to avoid reprocessing identical entries.
 * Preserves original generation timestamps for cached data.
 */
export class FixDataCache {
  constructor(cacheDir = null) {
    this.cacheDir = cacheDir || path.join(process.cwd(), 'tmp/fixdata-cache');
    this.cacheFile = path.join(this.cacheDir, 'cache.json');
    this.cache = null;
  }

  /**
   * Ensures the cache directory exists
   */
  async ensureCacheDir() {
    await fs.ensureDir(this.cacheDir);
  }

  /**
   * Loads the cache from disk
   */
  async loadCache() {
    if (this.cache !== null) {
      return this.cache;
    }

    await this.ensureCacheDir();

    try {
      if (await fs.pathExists(this.cacheFile)) {
        const content = await fs.readFile(this.cacheFile, 'utf-8');
        this.cache = JSON.parse(content);
        return this.cache;
      }
    } catch (error) {
      console.warn(`[FixDataCache] Failed to load cache: ${error.message}`);
    }

    this.cache = {};
    return this.cache;
  }

  /**
   * Saves the cache to disk
   */
  async saveCache() {
    if (this.cache === null) {
      return;
    }

    await this.ensureCacheDir();

    try {
      await fs.writeFile(this.cacheFile, JSON.stringify(this.cache, null, 2), 'utf-8');
    } catch (error) {
      console.warn(`[FixDataCache] Failed to save cache: ${error.message}`);
    }
  }

  /**
   * Generates a cache key from input data
   * Uses NIK as primary key, optionally includes other fields for variation detection
   */
  getCacheKey(data) {
    const nik = data.NIK || data.nik;
    if (!nik) return null;
    return `nik_${nik}`;
  }

  /**
   * Gets a cached result for the given data
   * Returns null if not found or if cache is disabled
   */
  async get(data, options = {}) {
    if (options.useCache === false) {
      return null;
    }

    const key = this.getCacheKey(data);
    if (!key) return null;

    const cache = await this.loadCache();
    const cached = cache[key];

    if (cached) {
      if (options.verbose) {
        console.log(`[FixDataCache] Cache HIT for NIK: ${data.nik || data.NIK}`);
      }
      return cached.result;
    }

    if (options.verbose) {
      console.log(`[FixDataCache] Cache MISS for NIK: ${data.nik || data.NIK}`);
    }

    return null;
  }

  /**
   * Stores a result in the cache with metadata
   */
  async set(data, result, options = {}) {
    if (options.useCache === false) {
      return;
    }

    const key = this.getCacheKey(data);
    if (!key) return;

    const cache = await this.loadCache();

    cache[key] = {
      result,
      nik: data.NIK || data.nik,
      createdAt: new Date().toISOString(),
      inputHash: this.hashData(data)
    };

    await this.saveCache();

    if (options.verbose) {
      console.log(`[FixDataCache] Cached result for NIK: ${data.nik || data.NIK}`);
    }
  }

  /**
   * Simple hash function for input data to detect changes
   */
  hashData(data) {
    const important = {
      nik: data.nik || data.NIK,
      nama: data.nama || data.NAMA,
      tanggal: data.tanggal || data['TANGGAL ENTRY']
    };
    return JSON.stringify(important);
  }

  /**
   * Clears the entire cache
   */
  async clear(options = {}) {
    this.cache = {};
    await this.saveCache();

    if (options.verbose) {
      console.log('[FixDataCache] Cache cleared');
    }
  }

  /**
   * Clears a specific entry from the cache
   */
  async clearEntry(data, options = {}) {
    const key = this.getCacheKey(data);
    if (!key) return;

    const cache = await this.loadCache();
    delete cache[key];
    await this.saveCache();

    if (options.verbose) {
      console.log(`[FixDataCache] Cache entry cleared for NIK: ${data.nik || data.NIK}`);
    }
  }

  /**
   * Gets cache statistics
   */
  async getStats() {
    const cache = await this.loadCache();
    const entries = Object.keys(cache);
    const cacheSize = JSON.stringify(cache).length;

    return {
      totalEntries: entries.length,
      cacheSize: `${(cacheSize / 1024).toFixed(2)} KB`,
      cacheDir: this.cacheDir,
      cacheFile: this.cacheFile,
      entries: entries.map((key) => ({
        key,
        nik: cache[key].nik,
        createdAt: cache[key].createdAt
      }))
    };
  }
}

// Export singleton instance
export const fixDataCache = new FixDataCache();
