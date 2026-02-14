import moment from 'moment';
import { getAge } from '../date.js';

/**
 * Automatically detects and parses date format from a string
 * Supports multiple date formats and uses heuristics to distinguish between ambiguous formats
 * @param {string} dateStr - The date string to parse
 * @returns {string} The formatted date in DD/MM/YYYY format, or original string if parsing fails
 */
export function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return dateStr;

  // First, try formats with unique patterns
  const uniqueFormats = [
    { pattern: 'YYYY-MM-DD', regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/ },
    { pattern: 'DD-MM-YYYY', regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/ },
    { pattern: 'YYYY/MM/DD', regex: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/ }
  ];

  for (const { pattern, regex } of uniqueFormats) {
    const match = dateStr.match(regex);
    if (match) {
      const parsed = moment(dateStr, pattern, true);
      if (parsed.isValid()) {
        const year = parsed.year();
        if (year >= 1900 && year <= new Date().getFullYear() + 10) {
          return parsed.format('DD/MM/YYYY');
        }
      }
    }
  }

  // Handle ambiguous DD/MM/YYYY vs MM/DD/YYYY formats
  const ambiguousRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = dateStr.match(ambiguousRegex);
  if (match) {
    const [, first, second] = match;
    const firstNum = parseInt(first, 10);
    const secondNum = parseInt(second, 10);

    // Heuristics to determine format:
    // 1. If first number > 12, it must be DD/MM/YYYY
    if (firstNum > 12) {
      const parsed = moment(dateStr, 'DD/MM/YYYY', true);
      if (parsed.isValid() && parsed.year() >= 1900 && parsed.year() <= new Date().getFullYear() + 10) {
        return parsed.format('DD/MM/YYYY');
      }
    }

    // 2. If second number > 12, it must be MM/DD/YYYY
    if (secondNum > 12) {
      const parsed = moment(dateStr, 'MM/DD/YYYY', true);
      if (parsed.isValid() && parsed.year() >= 1900 && parsed.year() <= new Date().getFullYear() + 10) {
        return parsed.format('DD/MM/YYYY');
      }
    }

    // 3. If both numbers <= 12, try DD/MM/YYYY first (more common format)
    const ddmmParsed = moment(dateStr, 'DD/MM/YYYY', true);
    if (ddmmParsed.isValid() && ddmmParsed.year() >= 1900 && ddmmParsed.year() <= new Date().getFullYear() + 10) {
      return ddmmParsed.format('DD/MM/YYYY');
    }

    // 4. Fallback to MM/DD/YYYY
    const mmddParsed = moment(dateStr, 'MM/DD/YYYY', true);
    if (mmddParsed.isValid() && mmddParsed.year() >= 1900 && mmddParsed.year() <= new Date().getFullYear() + 10) {
      return mmddParsed.format('DD/MM/YYYY');
    }
  }

  // If no format matches, return original
  return dateStr;
}

export { parseDate as dateStringToDDMMYYYY };

/**
 * Parse an age-or-date string and return age in whole years.
 *
 * Behavior:
 * - Accepts age phrases like "5 tahun, 3 bulan, 12 hari" and returns the years (e.g. 5).
 * - Accepts birthdate strings (various formats handled by `parseDate`) and delegates to `getAge` with a moment birth date.
 * - Returns `undefined` when the input cannot be interpreted as an age or valid birth date.
 *
 * @param {string} dateStr - Age text (e.g. "5 tahun...") or a birthdate string.
 * @returns {number|undefined} Age in whole years, or `undefined` if not parsable.
 *
 * @example
 * getAgeFromDateString('5 tahun, 3 bulan'); // 5
 * getAgeFromDateString('24/05/1990'); // 35 (depending on current date)
 */
export function getAgeFromDateString(dateStr) {
  // 5 tahun, 3 bulan, 12 hari
  const ageRegex = /(\d+)\s*tahun/i;
  const match = dateStr.match(ageRegex);
  if (match) {
    return parseInt(match[1], 10);
  }
  // Try to parse as date and calculate age
  const parsedDate = parseDate(dateStr);
  if (parsedDate !== dateStr) {
    const birthDate = moment(parsedDate, 'DD/MM/YYYY');
    if (birthDate.isValid()) {
      return getAge(birthDate);
    }
  }
}
