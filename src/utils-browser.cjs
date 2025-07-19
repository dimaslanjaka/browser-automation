import { logLine } from './utils';

/**
 * Pauses execution for a specified amount of time.
 * @function sleep
 * @param {number} ms - The number of milliseconds to sleep.
 * @returns {Promise<void>} A promise that resolves after the specified time.
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
} /**
 * Extracts only numbers from a string and removes all whitespaces.
 * @function getNumbersOnly
 * @param {string} str - The input string.
 * @returns {string} A string containing only numeric characters.
 */

export function getNumbersOnly(str) {
  return `${str}`.replace(/\D+/g, '').trim();
} /**
 * Extracts a number (integer or float) from a string, preserving decimal separator as comma.
 * If the input is already a number, returns it as a string (with comma if float).
 *
 * @function extractNumericWithComma
 * @param {string|number} str - The input string or number.
 * @returns {string} A string containing the numeric value, with decimal comma if applicable.
 */

export function extractNumericWithComma(str) {
  if (typeof str === 'number') {
    // Convert number to string, replace dot with comma if float
    return String(str).replace('.', ',');
  }
  const match = `${str}`.match(/\d+[.,]?\d*/);
  if (match) {
    // Replace decimal dot with comma
    return match[0].replace('.', ',');
  }
  return '';
} /**
 * Merges an array of objects by a unique key, combining non-null and non-empty values.
 *
 * @param {Array<Object>} data - The array of objects to merge.
 * @param {string} key - The key to group by (e.g., 'nik').
 * @returns {Array<Object>} An array of merged objects, one per unique key.
 */

export function uniqueArrayObjByKey(data, key) {
  return Object.values(
    data.reduce((acc, item) => {
      const id = item[key];
      if (!acc[id]) {
        acc[id] = { ...item };
      } else {
        for (const prop in item) {
          if (prop !== key && item[prop] !== null && item[prop] !== '') {
            acc[id][prop] = item[prop];
          }
        }
      }
      return acc;
    }, {})
  );
} /**
 * Get all weekdays (Monday to Friday) in the current month.
 *
 * @param {boolean} [debug=false] - If true, logs debug information with the formatted date and day name.
 * @returns {string[]} Array of dates in the format DD/MM/YYYY for all weekdays in the current month.
 *
 * @example
 * // Get weekdays without debug info
 * const weekdays = getWeekdaysOfCurrentMonth();
 * logLine(weekdays);
 *
 * @example
 * // Get weekdays with debug info
 * const weekdaysWithDebug = getWeekdaysOfCurrentMonth(true);
 * logLine(weekdaysWithDebug);
 */

export function getWeekdaysOfCurrentMonth(debug = false) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // January = 0

  const result = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
    const dayName = date.toLocaleString('en-us', { weekday: 'long' }); // Get day name

    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    const formattedDate = `${dd}/${mm}/${yyyy}`;

    if (debug) {
      logLine(`Date: ${formattedDate}, Day: ${dayName}`);
    }

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      result.push(formattedDate);
    }
  }

  return result;
}
