import { jest } from '@jest/globals';
import { getAgeFromDateString } from '../../src/utils/date.js';

describe('getAgeFromDateString', () => {
  beforeAll(() => {
    jest.useFakeTimers('modern');
    // Freeze time to 2026-02-14 to make age calculation deterministic
    jest.setSystemTime(new Date('2026-02-14T12:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('calculates age for 04/08/2019 (DD/MM/YYYY)', () => {
    const age = getAgeFromDateString('5 tahun 6 bulan');
    expect(age).toBe(5);
  });
});
