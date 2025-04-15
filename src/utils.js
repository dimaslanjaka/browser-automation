import path from 'node:path';
import fs from 'fs-extra';

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
 * Appends a log entry to the specified log file.
 *
 * @param {any} data - The data to be logged.
 * @param {string} [message='Processed Data'] - A custom message for the log entry.
 * @param {string|null} [logFilePath=null] - The path to the log file. Defaults to `.cache/lastData.log` in the current directory.
 */
export function appendLog(data, message = 'Processed Data', logFilePath = null) {
  if (!logFilePath) logFilePath = defaultLogFilePath;
  const logEntry = `${new Date().toISOString()} - ${message}: ${JSON.stringify(data)}\n`;
  fs.appendFileSync(logFilePath, logEntry, 'utf8');
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
