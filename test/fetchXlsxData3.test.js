import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { fetchXlsxData3 } from '../src/fetchXlsxData3.js';
import { clearCache } from '../src/xlsx-helper.js';

describe('fetchXlsxData3', () => {
  const testCacheDir = path.join(process.cwd(), '.cache/temp');
  const logFile = path.join(process.cwd(), '.cache/temp/test-logs.txt');

  let consoleLogSpy;
  let logMessages = [];

  beforeAll(() => {
    // Capture console.log messages to array and optionally to file
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args) => {
      const message = args.join(' ');
      logMessages.push(message);
    });
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();

    // Write all captured logs to file at the end
    if (logMessages.length > 0) {
      const logDir = path.dirname(logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      fs.writeFileSync(logFile, logMessages.join('\n') + '\n');
      console.log(`Test logs written to: ${logFile}`);
    }
  });

  test('should throw error when no Excel files found', async () => {
    // Temporarily rename the .cache/sheets directory to simulate no files
    const sheetsDir = path.join(process.cwd(), '.cache/sheets');
    const backupDir = path.join(process.cwd(), '.cache/sheets_backup');

    if (fs.existsSync(sheetsDir)) {
      fs.renameSync(sheetsDir, backupDir);
    }

    try {
      await expect(fetchXlsxData3(0, 10)).rejects.toThrow('No Excel files found.');
    } finally {
      // Restore the directory
      if (fs.existsSync(backupDir)) {
        fs.renameSync(backupDir, sheetsDir);
      }
    }
  });

  test('should return cached data on second call', async () => {
    // Skip if no Excel files available
    const files = fs.readdirSync(path.join(process.cwd(), '.cache/sheets')).filter((file) => file.endsWith('.xlsx'));

    if (files.length === 0) {
      console.log('Skipping test: No Excel files found');
      return;
    }

    const startIndex = 7488;
    const lastIndex = 7490;

    // First call should miss cache
    const startTime1 = Date.now();
    const result1 = await fetchXlsxData3(startIndex, lastIndex);
    const duration1 = Date.now() - startTime1;

    // Second call should hit cache
    const startTime2 = Date.now();
    const result2 = await fetchXlsxData3(startIndex, lastIndex);
    const duration2 = Date.now() - startTime2;

    // Results should be identical
    expect(result2).toEqual(result1);

    // Second call should be significantly faster
    expect(duration2).toBeLessThan(duration1 / 2);

    // Cache file should exist
    const cacheFiles = fs.readdirSync(testCacheDir).filter((file) => file.startsWith('fetchXlsxData3_'));
    expect(cacheFiles.length).toBeGreaterThan(0);
  });

  test('should process data correctly', async () => {
    // Skip if no Excel files available
    const files = fs.readdirSync(path.join(process.cwd(), '.cache/sheets')).filter((file) => file.endsWith('.xlsx'));

    if (files.length === 0) {
      console.log('Skipping test: No Excel files found');
      return;
    }

    const result = await fetchXlsxData3(7488, 7490);

    expect(Array.isArray(result)).toBe(true);

    if (result.length > 0) {
      const firstItem = result[0];

      // Check that required fields exist
      expect(firstItem).toHaveProperty('rowIndex');
      expect(firstItem).toHaveProperty('nik');
      expect(firstItem).toHaveProperty('nama');
      expect(firstItem).toHaveProperty('tanggal');

      // Check that rowIndex is within expected range
      expect(firstItem.rowIndex).toBeGreaterThanOrEqual(7488);
      expect(firstItem.rowIndex).toBeLessThanOrEqual(7490);
    }
  });

  test('should clear cache correctly', async () => {
    // Skip if no Excel files available
    const files = fs.readdirSync(path.join(process.cwd(), '.cache/sheets')).filter((file) => file.endsWith('.xlsx'));

    if (files.length === 0) {
      console.log('Skipping test: No Excel files found');
      return;
    }

    // Create cache
    await fetchXlsxData3(7488, 7490);

    // Verify cache exists
    let cacheFiles = fs.readdirSync(testCacheDir).filter((file) => file.startsWith('fetchXlsxData3_'));
    expect(cacheFiles.length).toBeGreaterThan(0);

    // Clear cache
    clearCache('fetchXlsxData3_*.json');

    // Verify cache is cleared
    cacheFiles = fs.readdirSync(testCacheDir).filter((file) => file.startsWith('fetchXlsxData3_'));
    expect(cacheFiles.length).toBe(0);
  });

  test('should handle different index ranges', async () => {
    // Skip if no Excel files available
    const files = fs.readdirSync(path.join(process.cwd(), '.cache/sheets')).filter((file) => file.endsWith('.xlsx'));

    if (files.length === 0) {
      console.log('Skipping test: No Excel files found');
      return;
    }

    const result1 = await fetchXlsxData3(7488, 7490);
    const result2 = await fetchXlsxData3(7491, 7493);

    // Different ranges should create different cache entries
    const cacheFiles = fs.readdirSync(testCacheDir).filter((file) => file.startsWith('fetchXlsxData3_'));
    expect(cacheFiles.length).toBe(2);

    // Results should be different
    expect(result1).not.toEqual(result2);

    if (result1.length > 0 && result2.length > 0) {
      expect(result1[0].rowIndex).not.toBe(result2[0].rowIndex);
    }
  });

  test('should handle string parameters correctly', async () => {
    // Skip if no Excel files available
    const files = fs.readdirSync(path.join(process.cwd(), '.cache/sheets')).filter((file) => file.endsWith('.xlsx'));

    if (files.length === 0) {
      console.log('Skipping test: No Excel files found');
      return;
    }

    // Test with string parameters
    const resultWithStrings = await fetchXlsxData3('7488', '7490');

    // Test with number parameters for comparison
    const resultWithNumbers = await fetchXlsxData3(7488, 7490);

    // Results should be identical
    expect(resultWithStrings).toEqual(resultWithNumbers);

    // Test with invalid string parameters (should default to fallback values)
    const resultWithInvalidStrings = await fetchXlsxData3('invalid', 'also_invalid');
    const resultWithDefaults = await fetchXlsxData3(0, Number.MAX_SAFE_INTEGER);

    expect(resultWithInvalidStrings).toEqual(resultWithDefaults);
  });
});
