import { afterAll, beforeAll, describe, expect, jest, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';
import { getDataRange } from '../src/xlsx-helper.js';

describe('getDataRange', () => {
  let consoleLogSpy;
  let logMessages = [];

  beforeAll(() => {
    // Capture console.log messages to array
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation((...args) => {
      const message = args.join(' ');
      logMessages.push(message);
    });
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();

    // Optionally write all captured logs to file for debugging
    if (logMessages.length > 0) {
      const logFile = path.join(process.cwd(), 'tmp', 'getDataRange-test-logs.txt');
      const logDir = path.dirname(logFile);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      fs.writeFileSync(logFile, logMessages.join('\n') + '\n');
      console.log(`Test logs written to: ${logFile}`);
    }
  });

  // Sample test data that mimics Excel row data
  const sampleData = [
    { NIK: '1234567890123456', NAMA: 'John Doe', ALAMAT: 'Jl. Test 1', originalRowNumber: 1 },
    { NIK: '2345678901234567', NAMA: 'Jane Smith', ALAMAT: 'Jl. Test 2', originalRowNumber: 2 },
    { NIK: '3456789012345678', NAMA: 'Bob Johnson', ALAMAT: 'Jl. Test 3', originalRowNumber: 3 },
    { NIK: '4567890123456789', NAMA: 'Alice Brown', ALAMAT: 'Jl. Test 4', originalRowNumber: 4 },
    { NIK: '5678901234567890', NAMA: 'Charlie Wilson', ALAMAT: 'Jl. Test 5', originalRowNumber: 5 },
    { NIK: '6789012345678901', NAMA: 'Diana Davis', ALAMAT: 'Jl. Test 6', originalRowNumber: 6 }
  ];

  test('should extract range between valid fromRow and toRow', async () => {
    const options = {
      fromNik: '2345678901234567',
      fromNama: 'Jane Smith',
      toNik: '4567890123456789',
      toNama: 'Alice Brown'
    };

    const result = await getDataRange(sampleData, options);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual(sampleData[1]); // Jane Smith
    expect(result[1]).toEqual(sampleData[2]); // Bob Johnson
    expect(result[2]).toEqual(sampleData[3]); // Alice Brown
  });

  test('should extract single row when fromRow and toRow are the same', async () => {
    const options = {
      fromNik: '3456789012345678',
      fromNama: 'Bob Johnson',
      toNik: '3456789012345678',
      toNama: 'Bob Johnson'
    };

    const result = await getDataRange(sampleData, options);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(sampleData[2]); // Bob Johnson
  });

  test('should extract range from first to last row', async () => {
    const options = {
      fromNik: '1234567890123456',
      fromNama: 'John Doe',
      toNik: '6789012345678901',
      toNama: 'Diana Davis'
    };

    const result = await getDataRange(sampleData, options);

    expect(result).toHaveLength(6);
    expect(result[0]).toEqual(sampleData[0]); // John Doe
    expect(result[5]).toEqual(sampleData[5]); // Diana Davis
  });

  test('should throw error when fromRow is not found', async () => {
    const options = {
      fromNik: '9999999999999999',
      fromNama: 'Non Existent',
      toNik: '4567890123456789',
      toNama: 'Alice Brown'
    };

    await expect(getDataRange(sampleData, options)).rejects.toThrow(
      'FromRow not found: NIK=9999999999999999, NAMA=Non Existent'
    );
  });

  test('should throw error when toRow is not found', async () => {
    const options = {
      fromNik: '2345678901234567',
      fromNama: 'Jane Smith',
      toNik: '9999999999999999',
      toNama: 'Non Existent'
    };

    await expect(getDataRange(sampleData, options)).rejects.toThrow(
      'ToRow not found: NIK=9999999999999999, NAMA=Non Existent'
    );
  });

  test('should throw error when fromNik exists but fromNama does not match', async () => {
    const options = {
      fromNik: '2345678901234567',
      fromNama: 'Wrong Name',
      toNik: '4567890123456789',
      toNama: 'Alice Brown'
    };

    await expect(getDataRange(sampleData, options)).rejects.toThrow(
      'FromRow not found: NIK=2345678901234567, NAMA=Wrong Name'
    );
  });

  test('should throw error when toNik exists but toNama does not match', async () => {
    const options = {
      fromNik: '2345678901234567',
      fromNama: 'Jane Smith',
      toNik: '4567890123456789',
      toNama: 'Wrong Name'
    };

    await expect(getDataRange(sampleData, options)).rejects.toThrow(
      'ToRow not found: NIK=4567890123456789, NAMA=Wrong Name'
    );
  });

  test('should throw error with reverse order (toRow index < fromRow index)', async () => {
    const options = {
      fromNik: '4567890123456789',
      fromNama: 'Alice Brown',
      toNik: '2345678901234567',
      toNama: 'Jane Smith'
    };

    // When fromIndex > toIndex, slice() returns empty array which fails validation
    await expect(getDataRange(sampleData, options)).rejects.toThrow('First row in rangeData is not fromRow');
  });

  test('should write to output file when outputFile option is provided', async () => {
    const tempDir = path.join(process.cwd(), 'tmp');
    const outputFile = path.join(tempDir, 'test-range-output.json');

    // Ensure temp directory exists
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Clean up any existing test file
    if (fs.existsSync(outputFile)) {
      fs.unlinkSync(outputFile);
    }

    const options = {
      fromNik: '2345678901234567',
      fromNama: 'Jane Smith',
      toNik: '4567890123456789',
      toNama: 'Alice Brown',
      outputFile: outputFile
    };

    const result = await getDataRange(sampleData, options);

    // Check that the file was created
    expect(fs.existsSync(outputFile)).toBe(true);

    // Check that the file content matches the result
    const fileContent = JSON.parse(fs.readFileSync(outputFile, 'utf-8'));
    expect(fileContent).toEqual(result);

    // Clean up the test file
    fs.unlinkSync(outputFile);
  });

  test('should handle empty data array', async () => {
    const options = {
      fromNik: '1234567890123456',
      fromNama: 'John Doe',
      toNik: '2345678901234567',
      toNama: 'Jane Smith'
    };

    await expect(getDataRange([], options)).rejects.toThrow('FromRow not found: NIK=1234567890123456, NAMA=John Doe');
  });

  test('should handle data with missing NIK or NAMA fields', async () => {
    const incompleteData = [
      { NIK: '1234567890123456', NAMA: 'John Doe' },
      { NIK: '2345678901234567' }, // Missing NAMA
      { NAMA: 'Bob Johnson' }, // Missing NIK
      { NIK: '4567890123456789', NAMA: 'Alice Brown' }
    ];

    const options = {
      fromNik: '1234567890123456',
      fromNama: 'John Doe',
      toNik: '4567890123456789',
      toNama: 'Alice Brown'
    };

    const result = await getDataRange(incompleteData, options);

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual(incompleteData[0]);
    expect(result[3]).toEqual(incompleteData[3]);
  });

  test('should validate that returned range starts and ends with correct rows', async () => {
    const options = {
      fromNik: '2345678901234567',
      fromNama: 'Jane Smith',
      toNik: '5678901234567890',
      toNama: 'Charlie Wilson'
    };

    const result = await getDataRange(sampleData, options);

    // The function includes validation that first row is fromRow and last row is toRow
    expect(result[0].NIK).toBe(options.fromNik);
    expect(result[0].NAMA).toBe(options.fromNama);
    expect(result[result.length - 1].NIK).toBe(options.toNik);
    expect(result[result.length - 1].NAMA).toBe(options.toNama);
  });

  test('should handle duplicate NIK with different NAMA', async () => {
    const dataWithDuplicateNik = [
      { NIK: '1234567890123456', NAMA: 'John Doe', originalRowNumber: 1 },
      { NIK: '1234567890123456', NAMA: 'John Smith', originalRowNumber: 2 }, // Same NIK, different NAMA
      { NIK: '2345678901234567', NAMA: 'Jane Smith', originalRowNumber: 3 }
    ];

    const options = {
      fromNik: '1234567890123456',
      fromNama: 'John Smith', // Should find the second row, not the first
      toNik: '2345678901234567',
      toNama: 'Jane Smith'
    };

    const result = await getDataRange(dataWithDuplicateNik, options);

    expect(result).toHaveLength(2);
    expect(result[0].NAMA).toBe('John Smith'); // Should be the second John, not the first
    expect(result[1].NAMA).toBe('Jane Smith');
  });
});
