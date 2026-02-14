import moment from 'moment-timezone';

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
 * Supported inputs:
 * - Age phrases like "5 tahun", "5 tahun, 3 bulan", "5 tahun 3 bulan 12 hari" (returns the years portion).
 * - Partial ages such as "3 bulan" or "12 hari" (treated as 0 years).
 * - Birthdate strings in multiple formats (delegates parsing to `parseDate` and age calculation to `getAge`).
 *
 * Return values:
 * - {number} Whole years (e.g. 5).
 * - {0} When input expresses months/days only.
 * - {undefined} When the input cannot be parsed as an age or valid birth date.
 *
 * @param {string} dateStr - Age text (e.g. "5 tahun, 3 bulan") or a birthdate string.
 * @returns {number|undefined} Age in whole years, or `undefined` if not parsable.
 *
 * @example
 * getAgeFromDateString('5 tahun, 3 bulan'); // 5
 * getAgeFromDateString('3 bulan, 12 hari'); // 0
 * getAgeFromDateString('24/05/1990'); // age in years (delegates to `getAge`)
 */
export function getAgeFromDateString(dateStr) {
  // 5 tahun, 3 bulan, 12 hari
  const ageRegex = /(\d+)\s*tahun/i;
  const match = dateStr.match(ageRegex);
  if (match) {
    return parseInt(match[1], 10);
  }
  // 3 bulan, 12 hari (treat as 0 years)
  const monthDayRegex = /(\d+)\s*bulan/i;
  if (monthDayRegex.test(dateStr)) {
    return 0;
  }
  // 12 hari (treat as 0 years)
  const dayOnlyRegex = /(\d+)\s*hari/i;
  if (dayOnlyRegex.test(dateStr)) {
    return 0;
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

/**
 * Calculates the age in years from a given birth date string using a specified format.
 *
 * @param {string} dateString - The birth date as a string.
 * @param {import('moment').MomentFormatSpecification} [dateFormat='DD/MM/YYYY'] - The expected format of the input date string (default is 'DD/MM/YYYY').
 * @returns {number} The age in years. Returns 0 if the date is in the future.
 * @throws {Error} If the input date string is not valid according to the given format.
 */
export function getAge(dateString, dateFormat = 'DD/MM/YYYY') {
  let birthDate = moment(dateString, dateFormat, true); // Strict parsing

  if (!birthDate.isValid()) {
    throw new Error(`Invalid date format: "${dateString}". Expected format: ${dateFormat}`);
  }

  let age = moment().diff(birthDate, 'years');

  // Ensure age is never negative (handles future dates)
  return Math.max(0, age);
}
/**
 * Generate all dates in a given month (by name) excluding Sundays.
 * Supports both English and Indonesian month names.
 *
 * @param {string} monthName - Month name (e.g., "May", "Mei", "August", "Agustus").
 * @param {number} [year=new Date().getFullYear()] - The target year.
 * @param {string} [format="YYYY-MM-DD"] - Desired date format. Supported: "YYYY-MM-DD", "DD/MM/YYYY", "MM-DD-YYYY".
 * @param {boolean} [limitToToday=false] - If true, exclude future dates beyond today.
 * @returns {string[]} An array of formatted dates, excluding Sundays and optionally future dates.
 * @throws {Error} If the month name or format is invalid.
 */
export function getDatesWithoutSundays(
  monthName,
  year = new Date().getFullYear(),
  format = 'YYYY-MM-DD',
  limitToToday = false
) {
  const monthMap = {
    january: 0,
    februari: 1,
    february: 1,
    maret: 2,
    march: 2,
    april: 3,
    mei: 4,
    may: 4,
    juni: 5,
    june: 5,
    juli: 6,
    july: 6,
    agustus: 7,
    august: 7,
    september: 8,
    oktober: 9,
    october: 9,
    november: 10,
    desember: 11,
    december: 11
  };

  const key = monthName.toLowerCase();
  if (!(key in monthMap)) {
    throw new Error(`Unrecognized month name: "${monthName}"`);
  }

  const formatDate = (date) => {
    const pad = (n) => n.toString().padStart(2, '0');
    const YYYY = date.getFullYear();
    const MM = pad(date.getMonth() + 1);
    const DD = pad(date.getDate());

    switch (format) {
      case 'YYYY-MM-DD':
        return `${YYYY}-${MM}-${DD}`;
      case 'DD/MM/YYYY':
        return `${DD}/${MM}/${YYYY}`;
      case 'MM-DD-YYYY':
        return `${MM}-${DD}-${YYYY}`;
      default:
        throw new Error(`Unsupported date format: "${format}"`);
    }
  };

  const today = new Date();
  const month = monthMap[key];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dateList = [];

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);

    if (date.getDay() === 0) continue; // Skip Sundays
    if (limitToToday && date > today) break; // Stop at today if limit enabled

    dateList.push(formatDate(date));
  }

  return dateList;
}

/**
 * Checks if a string contains a month name in either English or Indonesian.
 *
 * @param {string} str - The input string to check.
 * @returns {boolean} Returns true if the string contains a month name, false otherwise.
 */
export function containsMonth(str) {
  const monthRegex =
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b/i;
  return monthRegex.test(str);
}

/**
 * Extracts the month name from a string if present.
 *
 * Supports full month names in English and Indonesian.
 *
 * @param {string} str - The input string to search.
 * @returns {string|null} The matched month name, or null if not found.
 */
export function extractMonthName(str) {
  const monthRegex =
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b/i;
  const match = str.match(monthRegex);
  return match ? match[0] : null;
}
