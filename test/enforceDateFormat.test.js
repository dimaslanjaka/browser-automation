import { describe, expect, jest, test } from '@jest/globals';
import { enforceDateFormat } from '../src/utils.js';

const formats = ['DD/MM/YYYY', 'DD-MM-YYYY', 'MM/DD/YYYY', 'MM-DD-YYYY', 'YYYY-MM-DD', 'YYYY/MM/DD'];

describe('normalizeBirthDateFromNIK', () => {
  test.each([
    ['12/06/2025', '12/06/2025'],
    ['12-06-2025', '12/06/2025'],
    ['06/12/2025', '06/12/2025'], // MM/DD/YYYY → DD/MM/YYYY (input was 6th Dec)
    ['06-12-2025', '06/12/2025'], // MM-DD-YYYY → DD/MM/YYYY (input was 6th Dec)
    ['2025-06-12', '12/06/2025'],
    ['2025/06/12', '12/06/2025']
  ])('correctly normalizes "%s" to DD/MM/YYYY', (input, expected) => {
    const result = enforceDateFormat(input, formats);
    expect(result).toBe(expected);
  });

  test('throws on invalid date string', () => {
    expect(() => {
      enforceDateFormat('invalid-date', formats, 'test field');
    }).toThrow(/Invalid birth date format.*test field/);
  });

  test('throws when format is correct but date is invalid (e.g. Feb 30)', () => {
    expect(() => {
      enforceDateFormat('30/02/2024', formats);
    }).toThrow(/Invalid birth date format/);
  });

  test('warns when original format is not DD/MM/YYYY', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    enforceDateFormat('2025-06-12', formats);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Converted birth date'));
    spy.mockRestore();
  });

  test('does not warn when input is already in DD/MM/YYYY', () => {
    const spy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    enforceDateFormat('12/06/2025', formats);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
