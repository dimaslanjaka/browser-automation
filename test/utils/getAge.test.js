import { getAge } from '../../src/utils/date.js';
import { jest } from '@jest/globals';

describe('getAge', () => {
  beforeAll(() => {
    jest.useFakeTimers('modern');
    // Freeze time to 2026-02-14 to make age calculation deterministic
    jest.setSystemTime(new Date('2026-02-14T12:00:00Z'));
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  test('calculates age for 04/08/2019 (DD/MM/YYYY)', () => {
    const age = getAge('04/08/2019');
    expect(age).toBe(6);
  });
});
