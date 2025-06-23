import { exec } from 'child_process';
import fs from 'fs-extra';
import moment from 'moment';
import path from 'node:path';
import { readfile } from 'sbg-utility';
import { nikParse } from './nik-parser/index.js';

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
 * Each object includes:
 * - `timestamp`: ISO string
 * - `status`: normalized to 'processed', 'skipped', or 'invalid'
 * - `data`: parsed JSON or error
 * - `raw`: the original line string from the log
 *
 * @param {string|null} [logFilePath=null] - The path to the log file. If `null`, uses `defaultLogFilePath`.
 * @returns {Array<{timestamp: string, status: string, data: import('../globals').ExcelRowData, raw: string}>}
 */
export function getLogData(logFilePath = null) {
  if (!logFilePath) logFilePath = defaultLogFilePath;
  const log = readfile(logFilePath);

  return log
    .trim()
    .split('\n')
    .map((line) => {
      const match = line.match(/^(.+?) - ([^:]+): (.+)$/);
      if (!match) {
        return {
          raw: line,
          error: 'Invalid log line format'
        };
      }

      const [_, timestamp, statusRaw, jsonStr] = match;

      // Normalize status to lowercase keyword
      const statusMap = {
        'processed data': 'processed',
        'skipped data': 'skipped',
        'invalid data': 'invalid'
      };
      const status = statusMap[statusRaw.trim().toLowerCase()] || statusRaw.trim().toLowerCase();

      let data;
      try {
        data = JSON.parse(jsonStr);
      } catch (_e) {
        data = { error: 'Invalid JSON', raw: jsonStr, line };
      }

      if (!data || typeof data !== 'object') {
        throw new Error(
          `Invalid data format at line ${log.split('\n').indexOf(line)}: "${line}" (Log path: ${logFilePath})`
        );
      }
      if (data.error) {
        throw new Error(
          `Error parsing log line at index ${log.split('\n').indexOf(line)}: ${data.error}. Line: "${line}" (Log path: ${logFilePath})`
        );
      }

      if (!data.parsed_nik && data.nik) {
        // If parsed_nik is not present, parse the NIK
        const nik_parser_result = nikParse(data.nik);
        if (nik_parser_result.status === 'success') {
          data.parsed_nik = nik_parser_result.data || {};
        }
      }

      return {
        timestamp,
        status,
        data,
        raw: line // this is what you asked for
      };
    });
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

/**
 * Converts the first character of each word in a string to uppercase.
 *
 * @param {string} str - The input string to be transformed.
 * @returns {string} The transformed string with each word's first letter in uppercase.
 */
export function ucwords(str) {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Normalize and validate a birth date (e.g. from NIK) to DD/MM/YYYY format.
 *
 * @param {string} dateStr - Raw birth date string (e.g. from parsed NIK).
 * @param {string[]} formats - List of acceptable input date formats. eg: ['DD/MM/YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY'].
 * @param {string} [context=''] - Optional context for clearer error messages.
 * @returns {string} - A normalized date string in DD/MM/YYYY format.
 * @throws Will throw an error if the input cannot be parsed with the given formats.
 */
export function enforceDateFormat(dateStr, formats, context = '') {
  const parsed = moment(dateStr, formats, true);
  if (!parsed.isValid()) {
    throw new Error(
      `❌ Invalid birth date format${context ? ` in ${context}` : ''}. Expected one of [${formats.join(', ')}], got: ${dateStr}`
    );
  }

  if (!moment(dateStr, 'DD/MM/YYYY', true).isValid()) {
    console.warn(`⚠️ Converted birth date to DD/MM/YYYY: ${parsed.format('DD/MM/YYYY')} (from: ${dateStr})`);
  }

  return parsed.format('DD/MM/YYYY');
}
