import * as glob from 'glob';
import moment from 'moment';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { array_random, writefile } from 'sbg-utility';
import { extractMonthName, getDatesWithoutSundays } from './date.js';

/**
 * Generates a hash for the given file
 * @param {string} filePath - Path to the file
 * @returns {string} SHA256 hash of the file
 */
export function getFileHash(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Generates a cache key
 * @param {string} prefix - Cache key prefix
 * @param {string} fileHash - Hash of the file
 * @param {...any} params - Additional parameters to include in the cache key
 * @returns {string} Cache key
 */
export function getCacheKey(prefix, fileHash, ...params) {
  const shortHash = fileHash.substring(0, 7); // Use first 7 characters of hash
  const paramString = params.length > 0 ? `_${params.join('_')}` : '';
  return `${prefix}_${shortHash}${paramString}`;
}

/**
 * Gets cached data if available and valid
 * @param {string} cacheKey - Cache key
 * @param {string} [cacheDir='.cache/temp'] - Cache directory relative to process.cwd()
 * @returns {Object|null} Cached data or null if not found/invalid
 */
export function getCachedData(cacheKey, cacheDir = '.cache/temp') {
  try {
    const cacheFile = path.join(process.cwd(), cacheDir, `${cacheKey}.json`);
    if (fs.existsSync(cacheFile)) {
      const cachedData = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
      console.log(`Cache hit: ${cacheKey}`);
      return cachedData;
    }
  } catch (error) {
    console.warn(`Cache read error for ${cacheKey}:`, error.message);
  }
  return null;
}

/**
 * Saves data to cache
 * @param {string} cacheKey - Cache key
 * @param {any} data - Data to cache
 * @param {string} [cacheDir='.cache/temp'] - Cache directory relative to process.cwd()
 */
export function saveCachedData(cacheKey, data, cacheDir = '.cache/temp') {
  try {
    const fullCacheDir = path.join(process.cwd(), cacheDir);
    if (!fs.existsSync(fullCacheDir)) {
      fs.mkdirSync(fullCacheDir, { recursive: true });
    }

    const cacheFile = path.join(fullCacheDir, `${cacheKey}.json`);
    fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2), 'utf-8');
    console.log(`Cache saved: ${cacheKey}`);
  } catch (error) {
    console.warn(`Cache save error for ${cacheKey}:`, error.message);
  }
}

/**
 * Clears cache files matching a pattern
 * @param {string} pattern - Glob pattern to match cache files
 * @param {string} [cacheDir='.cache/temp'] - Cache directory relative to process.cwd()
 */
export function clearCache(pattern, cacheDir = '.cache/temp') {
  try {
    const fullCacheDir = path.join(process.cwd(), cacheDir);
    if (!fs.existsSync(fullCacheDir)) {
      console.log('Cache directory does not exist');
      return;
    }

    const cacheFiles = glob.globSync(pattern, { cwd: fullCacheDir, absolute: true });
    let deletedCount = 0;

    cacheFiles.forEach((file) => {
      try {
        fs.unlinkSync(file);
        deletedCount++;
        console.log(`Deleted cache file: ${path.basename(file)}`);
      } catch (error) {
        console.warn(`Failed to delete ${file}:`, error.message);
      }
    });

    console.log(`Cleared ${deletedCount} cache file(s)`);
  } catch (error) {
    console.warn('Cache clear error:', error.message);
  }
}

/**
 * Find data rows by NIK
 * @param {import('../globals').ExcelRowData[]} datas - Array of Excel data
 * @param {string} targetNik - NIK to search for
 * @returns {import('../globals').ExcelRowData|null} Found data or null
 */
export function findByNik(datas, targetNik) {
  return datas.find((item) => item.nik === targetNik || `${item.nik}`.trim().includes(targetNik)) || null;
}

/**
 * Matches the first and last data against expected values
 * @param {import('../globals').ExcelRowData[]} datas - Array of Excel data
 * @param {Object} matchData - Expected first and last data
 * @returns {Object} Matching results
 */
export function matchFirstAndLastData(datas, matchData) {
  const firstItem = datas.at(0);
  const lastItem = datas.at(-1);

  const firstMatch = {
    nikMatch: firstItem?.nik === matchData.first.nik,
    namaMatch: firstItem?.nama === matchData.first.nama,
    actualNik: firstItem?.nik,
    actualNama: firstItem?.nama,
    expectedNik: matchData.first.nik,
    expectedNama: matchData.first.nama
  };

  const lastMatch = {
    nikMatch: lastItem?.nik === matchData.last.nik,
    namaMatch: lastItem?.nama === matchData.last.nama,
    actualNik: lastItem?.nik,
    actualNama: lastItem?.nama,
    expectedNik: matchData.last.nik,
    expectedNama: matchData.last.nama
  };

  return {
    first: firstMatch,
    last: lastMatch,
    overallMatch: firstMatch.nikMatch && firstMatch.namaMatch && lastMatch.nikMatch && lastMatch.namaMatch
  };
}

/**
 * Gets data range between two specific rows identified by NIK and NAMA.
 * @param {(import('../globals').ExcelRowData4 | import('../globals').ExcelRowData)[]} data - Array of Excel row data
 * @param {Object} options - Configuration object
 * @param {string} options.fromNik - NIK of the starting row
 * @param {string} options.fromNama - NAMA of the starting row
 * @param {string} options.toNik - NIK of the ending row
 * @param {string} options.toNama - NAMA of the ending row
 * @param {string} [options.outputFile] - Optional file path to write the range data
 * @returns {Promise<(import('../globals').ExcelRowData4 | import('../globals').ExcelRowData)[]>} - Array of rows between fromRow and toRow (inclusive)
 */
export async function getDataRange(data, { fromNik, fromNama, toNik, toNama, outputFile = null }) {
  const fromRow = data.find((row) => row.NIK === fromNik && row.NAMA === fromNama);
  const toRow = data.find((row) => row.NIK === toNik && row.NAMA === toNama);

  if (!fromRow) {
    throw new Error(`FromRow not found: NIK=${fromNik}, NAMA=${fromNama}`);
  }

  if (!toRow) {
    throw new Error(`ToRow not found: NIK=${toNik}, NAMA=${toNama}`);
  }

  const fromIndex = data.indexOf(fromRow);
  const toIndex = data.indexOf(toRow);
  const rangeData = data.slice(fromIndex, toIndex + 1);

  // console.log(`\nRange: from index ${fromIndex} to index ${toIndex}`);
  // console.log(`Total rows in range: ${rangeData.length}`);

  // Write to file if outputFile is provided
  if (outputFile) {
    writefile(outputFile, JSON.stringify(rangeData, null, 2), 'utf8');
    console.log(`\nRange data written to: ${outputFile}`);
    console.log(
      `File contains ${rangeData.length} rows from originalRowNumber ${rangeData[0]?.originalRowNumber} to ${rangeData[rangeData.length - 1]?.originalRowNumber}`
    );
  }

  // Validation
  if (rangeData[0] !== fromRow) {
    throw new Error('First row in rangeData is not fromRow');
  }

  if (rangeData[rangeData.length - 1] !== toRow) {
    throw new Error('Last row in rangeData is not toRow');
  }

  return rangeData;
}

/**
 *
 * @param {import('../globals').ExcelRowData4 | import('../globals').ExcelRowData} data
 */
export async function fixData(data) {
  if (!data || !data.NIK || !data.NAMA) {
    throw new Error('Invalid data format: NIK and NAMA are required');
  }
  if (data.NIK.length !== 16) {
    throw new Error(`Invalid NIK length: ${data.NIK} (expected 16 characters)`);
  }
  if (data.NAMA.length < 3) {
    throw new Error(`Invalid NAMA length: ${data.NAMA} (expected at least 3 characters)`);
  }
  let tanggalEntry = data.tanggal || data['TANGGAL ENTRY'];
  if (!tanggalEntry || !moment(tanggalEntry, 'DD/MM/YYYY', true).isValid()) {
    if (
      typeof tanggalEntry === 'string' &&
      /\b(jan(uari)?|feb(ruari)?|mar(et)?|apr(il)?|mei|jun(i|e)?|jul(i|y)?|agu(stus)?|aug(ust)?|sep(tember)?|okt(ober)?|oct(ober)?|nov(ember)?|des(ember)?|dec(ember)?|bln\s+\w+|bulan\s+\w+)\b/i.test(
        tanggalEntry
      )
    ) {
      const monthName = extractMonthName(tanggalEntry);
      if (!monthName) {
        throw new Error(`Month name not found in tanggalEntry: ${tanggalEntry}`);
      } else {
        const newDate = array_random(getDatesWithoutSundays(monthName, 2025, 'DD/MM/YYYY', true));
        // console.log(`Generated new date for "${tanggalEntry}": ${newDate}`);
        tanggalEntry = newDate;
      }
    }
    if (!moment(tanggalEntry, 'DD/MM/YYYY', true).isValid()) {
      throw new Error(`Invalid tanggalEntry format: ${tanggalEntry} (expected DD/MM/YYYY)`);
    } else {
      data.tanggal = tanggalEntry;
      data['TANGGAL ENTRY'] = tanggalEntry; // Ensure both fields are updated
    }
  }

  // if (data['TGL LAHIR']) {
  //   console.log(`Fixing TGL LAHIR: ${data['TGL LAHIR']}`);
  // }

  return data;
}
