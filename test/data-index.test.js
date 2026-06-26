import { describe, expect, test } from '@jest/globals';
import { normalizeCsvKey, normalizeEmptyKeys } from '../data/index.js';

describe('normalizeCsvKey', () => {
  test('normalizes headers with extra whitespace', () => {
    expect(normalizeCsvKey('NAMA ')).toBe('nama');
    expect(normalizeCsvKey(' TGL LAHIR ')).toBe('tgl_lahir');
  });

  test('normalizes lowercase headers', () => {
    expect(normalizeCsvKey('nik')).toBe('nik');
    expect(normalizeCsvKey('alamat')).toBe('alamat');
  });

  test('preserves unknown headers after trimming', () => {
    expect(normalizeCsvKey('  custom_field  ')).toBe('custom_field');
  });
});

describe('normalizeEmptyKeys', () => {
  test('removes empty key with empty value', () => {
    const row = { nama: 'John', '': '', nik: '123' };
    const result = normalizeEmptyKeys(row);
    expect(result).toEqual({ nama: 'John', nik: '123' });
    expect(result['']).toBeUndefined();
  });

  test('renames empty key with non-empty value to unknown1', () => {
    const row = { nama: 'John', '': 'extraData', nik: '123' };
    const result = normalizeEmptyKeys(row);
    expect(result).toEqual({ nama: 'John', unknown1: 'extraData', nik: '123' });
    expect(result['']).toBeUndefined();
  });

  test('renames multiple empty keys with non-empty values to unknown1, unknown2', () => {
    const row = { nama: 'John', '': 'first', nik: '123', ' ': 'second' };
    const result = normalizeEmptyKeys(row);
    expect(result).toEqual({ nama: 'John', unknown1: 'first', nik: '123', unknown2: 'second' });
    expect(result['']).toBeUndefined();
    expect(result[' ']).toBeUndefined();
  });

  test('handles mix of empty keys with empty and non-empty values', () => {
    const row = { nama: 'John', '': '', nik: '123', ' ': 'data' };
    const result = normalizeEmptyKeys(row);
    expect(result).toEqual({ nama: 'John', nik: '123', unknown1: 'data' });
  });

  test('leaves row unchanged if no empty keys', () => {
    const row = { nama: 'John', nik: '123', alamat: 'Street' };
    const result = normalizeEmptyKeys(row);
    expect(result).toEqual({ nama: 'John', nik: '123', alamat: 'Street' });
  });
});
