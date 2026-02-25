import fs from 'fs-extra';
import path from 'upath';

export const DEFAULT_CACHE_DIR = path.join(process.cwd(), 'tmp/fixdata-cache');

/**
 * Cache manager for fixData results.
 * Stores processed data by NIK to avoid reprocessing identical entries.
 * Preserves original generation timestamps for cached data.
 */
export class FixDataCache {
  constructor(cacheDir = null) {
    this.cacheDir = cacheDir || DEFAULT_CACHE_DIR;
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
    // For per-entry file storage we don't maintain a global in-memory cache.
    await this.ensureCacheDir();
    return null;
  }

  /**
   * Saves the cache to disk
   */
  async saveCache() {
    // No-op for per-entry storage; individual files are written by `set()`.
    return;
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
   * Build a filesystem-safe filename from data fields.
   */
  getFilename(data) {
    const nik = String(data.NIK || data.nik || '').trim();
    const nama = String(data.nama || data.NAMA || '').trim();
    // Prefer birth date fields: `tgl_lahir` (ExcelRowData) and `TGL LAHIR` (ExcelRowData4).
    const tanggal = String(data.tgl_lahir || data['TGL LAHIR'] || data['TANGGAL ENTRY'] || data.tanggal || '').trim();

    const parts = [nik, nama, tanggal].filter(Boolean).map((s) => this.sanitizeFilename(s));
    if (parts.length === 0) return null;

    // join with separator then collapse multiple underscores to a single one
    const raw = parts.join('__');
    return raw.replace(/_+/g, '_').replace(/^_+|_+$/g, '');
  }

  sanitizeFilename(str) {
    return str
      .normalize('NFKD')
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
  }

  getEntryFilePath(data) {
    const filename = this.getFilename(data);
    if (!filename) return null;
    return path.join(this.cacheDir, filename + '.json');
  }

  /**
   * Gets a cached result for the given data
   * Returns null if not found or if cache is disabled
   */
  async get(data, options = {}) {
    if (options.useCache === false) {
      return null;
    }
    const file = this.getEntryFilePath(data);
    if (!file) return null;

    try {
      if (await fs.pathExists(file)) {
        const content = await fs.readFile(file, 'utf-8');
        const parsed = JSON.parse(content);
        if (options.verbose) {
          console.log(`[FixDataCache] Cache HIT for file: ${path.basename(file)}`);
        }
        return parsed.result;
      }
    } catch (err) {
      console.warn(`[FixDataCache] Failed reading cache file: ${err.message}`);
    }

    if (options.verbose) {
      console.log(`[FixDataCache] Cache MISS for data: ${data.nik || data.NIK || 'unknown'}`);
    }

    return null;
  }

  /**
   * Stores a result in the cache with metadata.
   * @param {import('../../../globals').ExcelRowData4 | import('../../../globals').ExcelRowData} data - The original input data used as cache key.
   * @param {Object} result - The processed result to cache.
   * @param {Object} [options] - Cache options.
   * @param {boolean} [options.useCache=true] - Enable/disable caching for this entry.
   * @param {boolean} [options.verbose=false] - Enable verbose logging during caching.
   * @returns {Promise<void>}
   */
  async set(data, result, options = {}) {
    if (options.useCache === false) {
      return;
    }
    const file = this.getEntryFilePath(data);
    if (!file) return;

    const entry = {
      result,
      nik: data.NIK || data.nik,
      createdAt: new Date().toISOString(),
      inputHash: this.hashData(data)
    };

    await this.ensureCacheDir();

    try {
      await fs.writeFile(file, JSON.stringify(entry, null, 2), 'utf-8');
      if (options.verbose) {
        console.log(`[FixDataCache] Cached result to ${path.basename(file)}`);
      }
    } catch (err) {
      console.warn(`[FixDataCache] Failed to write cache file: ${err.message}`);
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
    await this.ensureCacheDir();
    try {
      await fs.emptyDir(this.cacheDir);
      if (options.verbose) console.log('[FixDataCache] Cache directory emptied');
    } catch (err) {
      console.warn(`[FixDataCache] Failed to clear cache directory: ${err.message}`);
    }
  }

  /**
   * Clears a specific entry from the cache
   */
  async clearEntry(data, options = {}) {
    const file = this.getEntryFilePath(data);
    if (!file) return;

    try {
      if (await fs.pathExists(file)) {
        await fs.remove(file);
        if (options.verbose) console.log(`[FixDataCache] Removed cache file: ${path.basename(file)}`);
      }
    } catch (err) {
      console.warn(`[FixDataCache] Failed to remove cache file: ${err.message}`);
    }
  }

  /**
   * Gets cache statistics
   */
  async getStats() {
    await this.ensureCacheDir();
    try {
      const files = await fs.readdir(this.cacheDir);
      let totalSize = 0;
      const entries = [];

      for (const f of files) {
        if (!f.endsWith('.json')) continue;
        const full = path.join(this.cacheDir, f);
        try {
          const stat = await fs.stat(full);
          totalSize += stat.size;
          const content = await fs.readFile(full, 'utf-8');
          const parsed = JSON.parse(content);
          entries.push({
            file: f,
            nik: parsed.nik,
            createdAt: parsed.createdAt
          });
        } catch (_err) {
          // skip malformed entries
        }
      }

      return {
        totalEntries: entries.length,
        cacheSize: `${(totalSize / 1024).toFixed(2)} KB`,
        cacheDir: this.cacheDir,
        entries
      };
    } catch (err) {
      console.warn(`[FixDataCache] Failed to read cache stats: ${err.message}`);
      return {
        totalEntries: 0,
        cacheSize: '0 KB',
        cacheDir: this.cacheDir,
        entries: []
      };
    }
  }
}

// Export singleton instance
export const fixDataCache = new FixDataCache();
