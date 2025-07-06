import moment from 'moment-timezone';

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
