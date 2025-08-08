import { parseDate } from '../../src/utils/date.js';

describe('parseDate', () => {
  describe('should handle empty or invalid inputs', () => {
    test('should return empty string when input is empty', () => {
      expect(parseDate('')).toBe('');
    });

    test('should return string when input is only whitespace', () => {
      expect(parseDate('   ')).toBe('   ');
    });

    test('should return null when input is null', () => {
      expect(parseDate(null)).toBe(null);
    });

    test('should return undefined when input is undefined', () => {
      expect(parseDate(undefined)).toBe(undefined);
    });

    test('should return original string when no valid date format matches', () => {
      expect(parseDate('not a date')).toBe('not a date');
      expect(parseDate('2023/13/45')).toBe('2023/13/45');
      expect(parseDate('32/13/2023')).toBe('32/13/2023');
    });
  });

  describe('should parse unique date formats correctly', () => {
    test('should parse YYYY-MM-DD format', () => {
      expect(parseDate('1979-06-30')).toBe('30/06/1979');
      expect(parseDate('2003-05-27')).toBe('27/05/2003');
      expect(parseDate('2023-12-25')).toBe('25/12/2023');
      expect(parseDate('2000-01-01')).toBe('01/01/2000');
    });

    test('should parse DD-MM-YYYY format', () => {
      expect(parseDate('30-06-1979')).toBe('30/06/1979');
      expect(parseDate('27-05-2003')).toBe('27/05/2003');
      expect(parseDate('25-12-2023')).toBe('25/12/2023');
      expect(parseDate('01-01-2000')).toBe('01/01/2000');
    });

    test('should parse YYYY/MM/DD format', () => {
      expect(parseDate('1979/06/30')).toBe('30/06/1979');
      expect(parseDate('2003/05/27')).toBe('27/05/2003');
      expect(parseDate('2023/12/25')).toBe('25/12/2023');
      expect(parseDate('2000/01/01')).toBe('01/01/2000');
    });
  });

  describe('should handle ambiguous DD/MM/YYYY vs MM/DD/YYYY formats', () => {
    test('should detect DD/MM/YYYY when first number > 12', () => {
      expect(parseDate('30/06/1979')).toBe('30/06/1979');
      expect(parseDate('31/12/2023')).toBe('31/12/2023');
      expect(parseDate('15/03/2000')).toBe('15/03/2000');
      expect(parseDate('25/11/1995')).toBe('25/11/1995');
    });

    test('should detect MM/DD/YYYY when second number > 12', () => {
      expect(parseDate('06/30/1979')).toBe('30/06/1979');
      expect(parseDate('12/31/2023')).toBe('31/12/2023');
      expect(parseDate('03/15/2000')).toBe('15/03/2000');
      expect(parseDate('11/25/1995')).toBe('25/11/1995');
    });

    test('should default to DD/MM/YYYY when both numbers <= 12', () => {
      expect(parseDate('12/11/1979')).toBe('12/11/1979');
      expect(parseDate('01/12/2023')).toBe('01/12/2023');
      expect(parseDate('10/05/2000')).toBe('10/05/2000');
      expect(parseDate('02/08/1995')).toBe('02/08/1995');
    });
  });

  describe('should validate year ranges', () => {
    test('should accept years within valid range (1900 - current year + 10)', () => {
      const currentYear = new Date().getFullYear();
      expect(parseDate('01/01/1900')).toBe('01/01/1900');
      expect(parseDate('01/01/2000')).toBe('01/01/2000');
      expect(parseDate(`01/01/${currentYear}`)).toBe(`01/01/${currentYear}`);
      expect(parseDate(`01/01/${currentYear + 5}`)).toBe(`01/01/${currentYear + 5}`);
    });

    test('should reject years outside valid range', () => {
      const currentYear = new Date().getFullYear();
      expect(parseDate('01/01/1899')).toBe('01/01/1899'); // Should return original
      expect(parseDate(`01/01/${currentYear + 11}`)).toBe(`01/01/${currentYear + 11}`); // Should return original
      expect(parseDate('01/01/1800')).toBe('01/01/1800'); // Should return original
    });
  });

  describe('should handle edge cases', () => {
    test('should handle leap year dates', () => {
      expect(parseDate('29/02/2020')).toBe('29/02/2020'); // Valid leap year
      expect(parseDate('2020-02-29')).toBe('29/02/2020'); // Valid leap year ISO format
    });

    test('should handle invalid leap year dates', () => {
      expect(parseDate('29/02/2021')).toBe('29/02/2021'); // Invalid leap year - should return original
    });

    test('should handle boundary dates', () => {
      expect(parseDate('31/01/2023')).toBe('31/01/2023');
      expect(parseDate('30/04/2023')).toBe('30/04/2023');
      expect(parseDate('28/02/2023')).toBe('28/02/2023');
    });

    test('should handle invalid day/month combinations', () => {
      expect(parseDate('31/02/2023')).toBe('31/02/2023'); // Should return original
      expect(parseDate('30/02/2023')).toBe('30/02/2023'); // Should return original
      expect(parseDate('32/01/2023')).toBe('32/01/2023'); // Should return original
    });
  });

  describe('should handle mixed format scenarios', () => {
    test('should process array of mixed date formats', () => {
      const mixedDates = [
        '30/06/1979', // DD/MM/YYYY
        '06/30/1980', // MM/DD/YYYY
        '1981-06-30', // YYYY-MM-DD
        '30-06-1982', // DD-MM-YYYY
        '1983/06/30', // YYYY/MM/DD
        '12/11/1984' // Ambiguous, defaults to DD/MM/YYYY
      ];

      const expected = ['30/06/1979', '30/06/1980', '30/06/1981', '30/06/1982', '30/06/1983', '12/11/1984'];

      mixedDates.forEach((date, index) => {
        expect(parseDate(date)).toBe(expected[index]);
      });
    });
  });
});
