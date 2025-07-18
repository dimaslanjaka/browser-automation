import ansiColors from 'ansi-colors';
import { exec } from 'child_process';
import fs from 'fs-extra';
import moment from 'moment';
import nikParse from 'nik-parser-jurusid';
import path from 'node:path';
import readline from 'node:readline';
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
 * Prompts the user to press Enter with an optional sound beep before continuing execution.
 *
 * @param {string} message - The message to display in the terminal prompt.
 * @param {boolean} [sound=true] - Whether to play a beep sound before prompting.
 * @returns {Promise<void>} A promise that resolves when the user presses Enter.
 */
export function waitEnter(message, sound = true) {
  return new Promise(function (resolve) {
    if (sound) singleBeep();
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(message, () => {
      rl.close(); // Close immediately after use
      resolve();
    });
  });
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
          if (nik_parser_result.data) {
            data.parsed_nik = nik_parser_result.data;
          }
        }
        if (!data.parsed_nik) {
          throw new Error(`NIK parsing failed for NIK: ${data.nik} at line: "${line}"`);
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

function colorizeJson(value, indent = 2, level = 0) {
  const space = ' '.repeat(indent * level);
  if (value === null) return ansiColors.gray('null');
  if (Array.isArray(value)) {
    if (value.length === 0) return ansiColors.cyan('[]');
    const items = value.map((item) => space + ' '.repeat(indent) + colorizeJson(item, indent, level + 1)).join(',\n');
    return ansiColors.cyan('[\n') + items + '\n' + space + ansiColors.cyan(']');
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return ansiColors.cyan('{}');
    const items = keys
      .map(
        (key) =>
          space +
          ' '.repeat(indent) +
          ansiColors.green('"' + key + '"') +
          ansiColors.cyan(': ') +
          colorizeJson(value[key], indent, level + 1)
      )
      .join(',\n');
    return ansiColors.cyan('{\n') + items + '\n' + space + ansiColors.cyan('}');
  }
  if (typeof value === 'string') {
    return ansiColors.yellow('"' + value + '"');
  }
  if (typeof value === 'number') {
    return ansiColors.magenta(value);
  }
  if (typeof value === 'boolean') {
    return ansiColors.blue(value);
  }
  return String(value);
}

/**
 * Logs one or more messages inline, overwriting the current line in the console.
 * Useful for progress indicators or status updates that should replace the previous message.
 * @function logInline
 * @param {...any} args - The messages to log inline. Objects and arrays will be JSON stringified.
 * @returns {void}
 */
export function logInline(...args) {
  let output;
  if (args.length > 1) {
    output = args
      .map((arg) => {
        if (arg === null) {
          return ansiColors.gray('null');
        } else if (typeof arg === 'object' && arg !== null) {
          try {
            return colorizeJson(arg);
          } catch (_e) {
            return ansiColors.red('[Unserializable Object]');
          }
        } else if (typeof arg === 'number') {
          return ansiColors.magenta(arg);
        } else if (typeof arg === 'boolean') {
          return ansiColors.blue(arg);
        }
        return String(arg);
      })
      .join(' ');
  } else {
    const message = args[0];
    if (message === null) {
      output = ansiColors.gray('null');
    } else if (typeof message === 'object' && message !== null) {
      try {
        output = colorizeJson(message);
      } catch (_e) {
        output = ansiColors.red('[Unserializable Object]');
      }
    } else if (typeof message === 'number') {
      output = ansiColors.magenta(message);
    } else if (typeof message === 'boolean') {
      output = ansiColors.blue(message);
    } else {
      output = String(message);
    }
  }
  process.stdout.write(`\r${output}`);
  global.__lastLogWasInline = true;
}

/**
 * Logs one or more messages on a new line in the console.
 * Standard logging function for messages that should appear on separate lines.
 * @function logLine
 * @param {...any} args - The messages to log on a new line. Objects and arrays will be JSON stringified.
 * @returns {void}
 */
export function logLine(...args) {
  let output;
  if (args.length > 1) {
    output = args
      .map((arg) => {
        if (arg === null) {
          return ansiColors.gray('null');
        } else if (typeof arg === 'object' && arg !== null) {
          try {
            return colorizeJson(arg);
          } catch (_e) {
            return ansiColors.red('[Unserializable Object]');
          }
        } else if (typeof arg === 'number') {
          return ansiColors.magenta(arg);
        } else if (typeof arg === 'boolean') {
          return ansiColors.blue(arg);
        }
        return String(arg);
      })
      .join(' ');
  } else {
    const message = args[0];
    if (message === null) {
      output = ansiColors.gray('null');
    } else if (typeof message === 'object' && message !== null) {
      try {
        output = colorizeJson(message);
      } catch (_e) {
        output = ansiColors.red('[Unserializable Object]');
      }
    } else if (typeof message === 'number') {
      output = ansiColors.magenta(message);
    } else if (typeof message === 'boolean') {
      output = ansiColors.blue(message);
    } else {
      output = String(message);
    }
  }
  // Only prepend a newline if the last log was inline
  const prefix = global.__lastLogWasInline ? '\n' : '';
  process.stdout.write(`${prefix}${output}\n`);
  global.__lastLogWasInline = false;
}
