import { describe, expect, test } from '@jest/globals';
import { fixData } from '../src/xlsx-helper.js';

describe('fixData - Basic Tests', () => {
  test('throws error when data is null', async () => {
    await expect(fixData(null)).rejects.toThrow('Invalid data format: data is required');
  });

  test('throws error when data is undefined', async () => {
    await expect(fixData(undefined)).rejects.toThrow('Invalid data format: data is required');
  });

  test('throws error when NIK is missing', async () => {
    const data = { NAMA: 'John Doe' };
    await expect(fixData(data)).rejects.toThrow('Invalid data format: NIK and NAMA are required');
  });

  test('throws error when NAMA is missing', async () => {
    const data = { NIK: '1234567890123456' };
    await expect(fixData(data)).rejects.toThrow('Invalid data format: NIK and NAMA are required');
  });

  test('throws error when NIK length is not 16', async () => {
    const data = {
      NIK: '123456789012345', // 15 characters
      NAMA: 'John Doe',
      'TANGGAL ENTRY': '15/01/2025'
    };
    await expect(fixData(data)).rejects.toThrow('Invalid NIK length: 123456789012345 (expected 16 characters)');
  });

  test('throws error when NAMA length is less than 3', async () => {
    const data = {
      NIK: '1234567890123456',
      NAMA: 'Jo', // 2 characters
      'TANGGAL ENTRY': '15/01/2025'
    };
    await expect(fixData(data)).rejects.toThrow('Invalid NAMA length: Jo (expected at least 3 characters)');
  });

  const realNIKs = ['3578100505210002', '3578106701210002', '3578101511210002'];

  test('accepts valid data with ExcelRowData4 format', async () => {
    const data = {
      NIK: realNIKs[0],
      NAMA: 'John Doe',
      'TANGGAL ENTRY': '15/01/2025'
    };
    const result = await fixData(data);
    expect(result.NIK).toBe(realNIKs[0]);
    expect(result.NAMA).toBe('John Doe');
    expect(result['TANGGAL ENTRY']).toBe('15/01/2025');
  });

  test('accepts valid data with mixed case fields', async () => {
    const data = {
      NIK: realNIKs[1],
      nama: 'Jane Doe',
      tanggal: '16/01/2025'
    };
    const result = await fixData(data);
    expect(result.NIK).toBe(realNIKs[1]);
    expect(result.nama).toBe('Jane Doe');
    expect(result.tanggal).toBe('16/01/2025');
  });

  test('throws error when tanggal entry is missing', async () => {
    const data = {
      NIK: realNIKs[2],
      NAMA: 'John Doe'
    };
    await expect(fixData(data)).rejects.toThrow('Tanggal entry is required');
  });

  test('throws error when date falls on Sunday', async () => {
    const data = {
      NIK: '1234567890123456',
      NAMA: 'John Doe',
      'TANGGAL ENTRY': '05/01/2025' // This is a Sunday
    };
    await expect(fixData(data)).rejects.toThrow('Tanggal entry cannot be a Sunday: 05/01/2025');
  });
});
