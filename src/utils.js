import { exec } from 'child_process';
import fs from 'fs-extra';
import path from 'node:path';
import { readfile } from 'sbg-utility';

export function singleBeep() {
  exec('[console]::beep(1000, 500)', { shell: 'powershell.exe' });
}

export function multiBeep() {
  exec('1..3 | %{ [console]::beep(1000, 500) }', { shell: 'powershell.exe' });
}

/**
 * Pauses execution for a specified amount of time.
 * @function sleep
 * @param {number} ms - The number of milliseconds to sleep.
 * @returns {Promise<void>} A promise that resolves after the specified time.
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extracts only numbers from a string and removes all whitespaces.
 * @function getNumbersOnly
 * @param {string} str - The input string.
 * @returns {string} A string containing only numeric characters.
 */
export function getNumbersOnly(str) {
  return `${str}`.replace(/\D+/g, '').trim();
}

/**
 * Extracts numeric characters from a string while preserving and converting decimal dots to commas.
 * @function extractNumericWithComma
 * @param {string} str - The input string.
 * @returns {string} A string containing only numeric characters and commas.
 */
export function extractNumericWithComma(str) {
  return `${str}`
    .replace(/\./g, ',') // Convert dots to commas
    .replace(/[^\d,]/g, '') // Remove all non-numeric and non-comma characters
    .trim();
}

export const defaultLogFilePath = path.join(process.cwd(), '.cache/lastData.log');

/**
 * Appends a log entry to the specified log file in the format:
 * `ISO_TIMESTAMP - MESSAGE: JSON_DATA`
 *
 * @param {any} data - The data to be logged. Will be serialized using `JSON.stringify`.
 * @param {string} [message='Processed Data'] - A label indicating the status or type of the log entry.
 * @param {string|null} [logFilePath=null] - The path to the log file. If `null`, defaults to `defaultLogFilePath`.
 */
export function appendLog(data, message = 'Processed Data', logFilePath = null) {
  if (!logFilePath) logFilePath = defaultLogFilePath;
  const logEntry = `${new Date().toISOString()} - ${message}: ${JSON.stringify(data)}\n`;
  fs.appendFileSync(logFilePath, logEntry, 'utf8');
}

/**
 * Reads and parses structured log entries from a log file.
 *
 * Normalizes log entry status to one of: 'processed', 'skipped', or 'invalid'.
 * Ignores malformed lines.
 *
 * @param {string|null} [logFilePath=null] - The path to the log file. If `null`, uses `defaultLogFilePath`.
 * @returns {Array<{timestamp: string, status: 'processed' | 'skipped' | 'invalid', data: any}>}
 */
export function getLogData(logFilePath = null) {
  if (!logFilePath) logFilePath = defaultLogFilePath;
  const log = readfile(logFilePath);

  return log
    .trim()
    .split('\n')
    .map((line) => {
      const match = line.match(/^(.+?) - ([^:]+): (.+)$/);
      if (!match) return null;

      const [_, timestamp, statusRaw, jsonStr] = match;

      // Normalize status
      let status;
      switch (statusRaw.trim().toLowerCase()) {
        case 'processed data':
          status = 'processed';
          break;
        case 'skipped data':
          status = 'skipped';
          break;
        case 'invalid data':
          status = 'invalid';
          break;
        default:
          status = statusRaw.trim().toLowerCase(); // fallback to raw lowercase status
      }

      let data;
      try {
        data = JSON.parse(jsonStr);
      } catch (_e) {
        data = { error: 'Invalid JSON', raw: jsonStr };
      }

      return {
        timestamp,
        status,
        data
      };
    })
    .filter(Boolean); // remove nulls
}

/**
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
}

/**
 * Get all weekdays (Monday to Friday) in the current month.
 *
 * @param {boolean} [debug=false] - If true, logs debug information with the formatted date and day name.
 * @returns {string[]} Array of dates in the format DD/MM/YYYY for all weekdays in the current month.
 *
 * @example
 * // Get weekdays without debug info
 * const weekdays = getWeekdaysOfCurrentMonth();
 * console.log(weekdays);
 *
 * @example
 * // Get weekdays with debug info
 * const weekdaysWithDebug = getWeekdaysOfCurrentMonth(true);
 * console.log(weekdaysWithDebug);
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
      console.log(`Date: ${formattedDate}, Day: ${dayName}`);
    }

    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      result.push(formattedDate);
    }
  }

  return result;
}
