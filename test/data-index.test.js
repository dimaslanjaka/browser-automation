import { describe, expect, test } from '@jest/globals';
import { normalizeCsvKey } from '../data/index.js';

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
