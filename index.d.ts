import * as moment from 'moment';
import { SharedPreferences } from 'sbg-utility';
import { PoolConnection } from 'mariadb';
import * as better_sqlite3 from 'better-sqlite3';
import * as puppeteer from 'puppeteer';
import { Page, Frame, WaitForSelectorOptions, JSHandle, KeyInput, Browser } from 'puppeteer';
import * as puppeteer_core from 'puppeteer-core';
import * as puppeteer_with_fingerprints from 'puppeteer-with-fingerprints';
import * as rebrowser_puppeteer_core from 'rebrowser-puppeteer-core';

/**
 * No-op fallback
 */
declare function noop(): void;
/**
 * Strip protocol (http/https) from a URL
 * @param {string} url
 * @returns {string}
 */
declare function stripProtocol(url: string): string;
/**
 * Load external JavaScript file with deduplication
 *
 * @param {string} url - The script URL to load
 * @param {LoadJSOpt} [props] - Optional settings
 * @returns {Promise<void>}
 *
 * @example
 * React.useEffect(() => { loadJS('//host/path/file.js') });
 *
 * // or in class React.Component
 * componentDidMount() { loadJS('//host/path/file.js') }
 */
declare function loadJS(url: string, props?: LoadJSOpt): Promise<void>;
/**
 * Pauses execution for a specified amount of time.
 * @function sleep
 * @param {number} ms - The number of milliseconds to sleep.
 * @returns {Promise<void>} A promise that resolves after the specified time.
 */
declare function sleep(ms: number): Promise<void>; /**
 * Extracts only numbers from a string and removes all whitespaces.
 * @function getNumbersOnly
 * @param {string} str - The input string.
 * @returns {string} A string containing only numeric characters.
 */
declare function getNumbersOnly(str: any): string; /**
 * Extracts a number (integer or float) from a string, preserving decimal separator as comma.
 * If the input is already a number, returns it as a string (with comma if float).
 *
 * @function extractNumericWithComma
 * @param {string|number} str - The input string or number.
 * @returns {string} A string containing the numeric value, with decimal comma if applicable.
 */
declare function extractNumericWithComma(str: any): string; /**
 * Merges an array of objects by a unique key, combining non-null and non-empty values.
 *
 * @param {Array<Object>} data - The array of objects to merge.
 * @param {string} key - The key to group by (e.g., 'nik').
 * @returns {Array<Object>} An array of merged objects, one per unique key.
 */
declare function uniqueArrayObjByKey(data: any, key: any): any[]; /**
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
declare function getWeekdaysOfCurrentMonth(debug?: boolean): string[];
declare function randomStr(len?: number): string;
type LoadJSOpt = {
    /**
     * - Whether to proxy the request (useful for CORS)
     */
    proxy?: boolean;
    /**
     * - Whether to load the script asynchronously
     */
    async?: boolean;
    /**
     * - Whether to defer script execution
     */
    defer?: boolean;
    /**
     * - onload handler
     */
    onload?: (arg0: Event) => void;
    /**
     * - onerror handler
     */
    onerror?: (arg0: Event) => void;
    /**
     * - Cross-origin attribute
     */
    crossOrigin?: string;
};

const { exec } = require('child_process');
const readline = require('node:readline');

/**
 * Prompts the user to press Enter with an optional sound beep before continuing execution.
 *
 * @param {string} message - The message to display in the terminal prompt.
 * @param {boolean} [sound=true] - Whether to play a beep sound before prompting.
 * @returns {Promise<void>} A promise that resolves when the user presses Enter.
 */
function waitEnter(message, sound = true) {
  return new Promise(function (resolve) {
    if (sound) {
      exec('[console]::beep(1000, 500)', { shell: 'powershell.exe' });
    }

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.emitKeypressEvents(process.stdin);

    const onKeypress = (str, key) => {
      if (key && key.name === 'escape') {
        process.exit(1);
      }
    };

    process.stdin.on('keypress', onKeypress);

    rl.question(message.replace(/(\.\.\.)\s*$/, '') + ' (Esc to exit)... ', () => {
      process.stdin.removeListener('keypress', onKeypress);
      rl.close();
      resolve();
    });
  });
}

module.exports = { waitEnter };

const ansiColors = require('ansi-colors');
const fs = require('fs-extra');
const nikParse = require('nik-parser-jurusid');
const path = require('node:path');
const { readfile } = require('sbg-utility');

const defaultLogFilePath = path.join(process.cwd(), '.cache/lastData.log');

/**
 * Appends a log entry to the specified log file in the format:
 * `ISO_TIMESTAMP - MESSAGE: JSON_DATA`
 *
 * @param {any} data - The data to be logged. Will be serialized using `JSON.stringify`.
 * @param {string} [message='Processed Data'] - A label indicating the status or type of the log entry.
 * @param {string|null} [logFilePath=null] - The path to the log file. If `null`, defaults to `defaultLogFilePath`.
 */
function appendLog(data, message = 'Processed Data', logFilePath = null) {
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
 * @returns {Array<{timestamp: string, status: string, data: object, raw: string}>}
 */
function getLogData(logFilePath = null) {
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
function logInline(...args) {
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
function logLine(...args) {
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

module.exports = { logLine, logInline, getLogData, appendLog, defaultLogFilePath };

/**
 * Automatically detects and parses date format from a string
 * Supports multiple date formats and uses heuristics to distinguish between ambiguous formats
 * @param {string} dateStr - The date string to parse
 * @returns {string} The formatted date in DD/MM/YYYY format, or original string if parsing fails
 */
declare function parseDate(dateStr: string): string;
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
declare function getAgeFromDateString(dateStr: string): number | undefined;
/**
 * Calculates the age in years from a given birth date string using a specified format.
 *
 * @param {string} dateString - The birth date as a string.
 * @param {import('moment').MomentFormatSpecification} [dateFormat='DD/MM/YYYY'] - The expected format of the input date string (default is 'DD/MM/YYYY').
 * @returns {number} The age in years. Returns 0 if the date is in the future.
 * @throws {Error} If the input date string is not valid according to the given format.
 */
declare function getAge(dateString: string, dateFormat?: moment.MomentFormatSpecification): number;
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
declare function getDatesWithoutSundays(monthName: string, year?: number, format?: string, limitToToday?: boolean): string[];
/**
 * Checks if a string contains a month name in either English or Indonesian.
 *
 * @param {string} str - The input string to check.
 * @returns {boolean} Returns true if the string contains a month name, false otherwise.
 */
declare function containsMonth(str: string): boolean;
/**
 * Extracts the month name from a string if present.
 *
 * Supports full month names in English and Indonesian.
 *
 * @param {string} str - The input string to search.
 * @returns {string|null} The matched month name, or null if not found.
 */
declare function extractMonthName(str: string): string | null;
/**
 * Normalize and validate a birth date (e.g. from NIK) to DD/MM/YYYY format.
 *
 * @param {string} dateStr - Raw birth date string (e.g. from parsed NIK).
 * @param {string[]} formats - List of acceptable input date formats. eg: ['DD/MM/YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY'].
 * @param {string} [context=''] - Optional context for clearer error messages.
 * @returns {string} - A normalized date string in DD/MM/YYYY format.
 * @throws Will throw an error if the input cannot be parsed with the given formats.
 */
declare function enforceDateFormat(dateStr: string, formats: string[], context?: string): string;

declare function singleBeep(): void;
declare function multiBeep(): void;

interface LogEntry<T> {
    id: string | number;
    data: T;
    message: string;
    timestamp?: string;
}
interface BaseLogDatabase {
    addLog<T = any>(log: LogEntry<T>, options?: {
        timeout?: number;
    }): Promise<void>;
    removeLog(id: LogEntry<any>['id']): Promise<boolean>;
    getLogById<T = any>(id: LogEntry<any>['id']): Promise<LogEntry<T> | undefined>;
    getLogs<T = any>(filterFn?: (log: LogEntry<T>) => boolean | Promise<boolean>, options?: {
        limit?: number;
        offset?: number;
    }): Promise<LogEntry<T>[]>;
    waitReady(): Promise<void>;
    close(): Promise<void> | void;
    isClosed(): boolean | Promise<boolean>;
}

interface MySQLConfig {
    host: string;
    user: string;
    password: string;
    database: string;
    port?: number | string;
    connectionLimit?: number;
    connectTimeout?: number;
}
declare class MySQLHelper {
    private pool?;
    private config;
    ready: boolean;
    private initializing?;
    constructor(config: MySQLConfig);
    initialize(): Promise<void>;
    private ensureInitialized;
    private _ensureDatabase;
    /**
     * Execute a simple query
     */
    query<T = any>(sql: string, params?: any[]): Promise<T[]>;
    /**
     * Execute insert/update/delete
     */
    execute(sql: string, params?: any[]): Promise<{
        affectedRows: number;
        insertId?: number;
    }>;
    /**
     * Transaction wrapper
     */
    transaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T>;
    /**
     * Close the pool
     */
    close(): Promise<void>;
}

declare const defaultOptions: Partial<MySQLConfig>;
/**
 * Options for adding a log entry.
 *
 * @property timeout Optional timeout in milliseconds for the database operation.
 * @property update Optional flag to update an existing log entry if it exists.
 */
interface AddLogOptions {
    /**
     * Timeout in milliseconds for the database operation. (default: 60000)
     */
    timeout?: number;
    /**
     * Whether to update an existing log entry if it exists. (default: true)
     */
    update?: boolean;
}
/**
 * Class representing a log database using MySQL.
 */
declare class MysqlLogDatabase implements BaseLogDatabase {
    private helper;
    private config;
    private readyPromise?;
    /**
     * Create a new MysqlLogDatabase instance.
     *
     * @param dbName Optional database name (not used, for compatibility)
     * @param options Optional pool options (e.g., connectTimeout)
     */
    constructor(dbName?: string, options?: Partial<MySQLConfig>);
    waitReady(): Promise<void>;
    private ensureReady;
    /**
     * Execute a raw SQL query on the underlying MySQL pool.
     *
     * @param sql The SQL query string.
     * @param params Optional parameters for the query.
     * @returns Promise resolving to the query result.
     */
    query<T>(sql: string, params?: any[]): Promise<T[]>;
    /**
     * Add or update a log entry in the database.
     *
     * @param log Log entry object.
     * @param options Optional query options (e.g., timeout in ms)
     * @returns Promise that resolves when the log is added or updated.
     */
    addLog<T = any>({ id, data, message, timestamp }: LogEntry<T>, options?: AddLogOptions): Promise<void>;
    /**
     * Remove a log entry by its id.
     *
     * @param id Unique log identifier.
     * @returns Promise that resolves to true if a log was removed, false otherwise.
     */
    removeLog(id: LogEntry<any>['id']): Promise<boolean>;
    /**
     * Get a log entry by its id.
     *
     * @param id Unique log identifier.
     * @returns Promise that resolves to the log object or undefined if not found.
     */
    getLogById<T = any>(id: LogEntry<T>['id']): Promise<LogEntry<T> | undefined>;
    /**
     * Get all logs or filtered logs from the database.
     *
     * @param filterFn Optional filter function to apply to each log entry after fetching from the database. Can be async.
     * @param options Optional object with limit and offset for pagination.
     * @returns Promise that resolves to an array of log objects.
     */
    getLogs<T = any>(filterFn?: (log: LogEntry<T>) => boolean | Promise<boolean>, options?: {
        limit?: number;
        offset?: number;
    }): Promise<LogEntry<T>[]>;
    closed: boolean;
    isClosed(): boolean;
    /**
     * Close the database connection pool.
     *
     * @returns Promise that resolves when the pool is closed.
     */
    close(): Promise<void>;
}

/**
 * Get the absolute file path for a SQLite database file by name.
 * @param {string} name - Database filename without extension.
 * @returns {string} Absolute path to the database file.
 */
declare function getDatabaseFilePath(name: string): string;
/**
 * Class representing a log database using SQLite.
 */
declare class SQLiteLogDatabase {
    /**
     * Create a new LogDatabase instance.
     * @param {string} [dbFileName] - Optional database filename without extension. Defaults to environment variable DATABASE_FILENAME or 'default'.
     */
    constructor(dbFileName?: string);
    /** @type {string} */
    dbPath: string;
    /** @type {import('better-sqlite3').Database | undefined} */
    db: better_sqlite3.Database | undefined;
    /**
     * Execute a raw SQL query on the underlying SQLite database.
     * @param {string} sql - The SQL query string.
     * @param {any[]} [params] - Optional parameters for the query.
     * @returns {any} The result of the query.
     */
    query(sql: string, params?: any[]): any;
    /**
     * Close the database connection.
     */
    close(): void;
    /**
     * Check if the pool is closed.
     * @returns {boolean}
     */
    isClosed(): boolean;
    /**
     * Backup the SQLite database file to a specified destination (raw SQLite file, not SQL dump).
     * Uses better-sqlite3's native backup method for reliability and performance.
     * @param {string} destPath - The destination file path for the backup (will be a binary SQLite file).
     * @returns {Promise<import('better-sqlite3').BackupMetadata>} Resolves when backup is complete.
     */
    backup(destPath: string): Promise<better_sqlite3.BackupMetadata>;
    /**
     * Initialize the database: set journal mode and create logs table if not exists.
     * @private
     */
    private initialize;
    /**
     * Add or update a log entry in the database.
     * @param {import('./BaseLogDatabase').LogEntry} log - Log entry object.
     */
    addLog(log: LogEntry<any>): void;
    /**
     * Remove a log entry by its id.
     * @param {import('./BaseLogDatabase').LogEntry['id']} id - Unique log identifier.
     * @returns {boolean} True if a log was removed, false otherwise.
     */
    removeLog(id: LogEntry<any>["id"]): boolean;
    /**
     * Get a log entry by its id.
     * @param {import('./BaseLogDatabase').LogEntry['id']} id - Unique log identifier.
     * @returns {import('./BaseLogDatabase').LogEntry | undefined} Log object or undefined if not found.
     */
    getLogById(id: LogEntry<any>["id"]): LogEntry<any> | undefined;
    /**
     * Get all logs or filtered logs from the database.
     *
     * @param {(log: import('./BaseLogDatabase').LogEntry) => boolean | Promise<boolean>} [filterFn] Optional filter function to apply to each log entry after fetching from the database.
     * @param {Object} [options] Optional pagination options.
     * @param {number} [options.limit] Maximum number of logs to return.
     * @param {number} [options.offset] Number of logs to skip before starting to collect the result set.
     * @returns {Array<import('./BaseLogDatabase').LogEntry>} Array of log objects with shape: { id, data, message, timestamp }.
     */
    getLogs(filterFn?: (log: LogEntry<any>) => boolean | Promise<boolean>, options?: {
        limit?: number;
        offset?: number;
    }): Array<LogEntry<any>>;
}

type MySQL2Options = Partial<MySQLConfig>;
interface LogDatabaseOptions extends MySQL2Options {
    [key: string]: any;
    type?: 'sqlite' | 'mysql';
}
declare class LogDatabase<TDefault = any> implements BaseLogDatabase {
    options: LogDatabaseOptions;
    dbName: string;
    store: MysqlLogDatabase | SQLiteLogDatabase;
    pref: SharedPreferences;
    sqliteDbPath: string;
    constructor(dbName?: string, options?: LogDatabaseOptions);
    getType(): Promise<{
        optionsType: "sqlite" | "mysql";
        classType: string;
    }>;
    addLog<T = TDefault>(log: LogEntry<T>, options?: {
        timeout?: number;
    }): Promise<void>;
    removeLog(id: LogEntry<TDefault>['id']): Promise<boolean>;
    getLogById<T = TDefault>(id: LogEntry<T>['id']): Promise<LogEntry<T> | undefined>;
    getLogs<T = TDefault>(filterFn?: (log: LogEntry<T>) => boolean | Promise<boolean>, options?: {
        limit?: number;
        offset?: number;
    }): Promise<LogEntry<T>[]>;
    waitReady(): Promise<void>;
    query<T>(sql: string, params?: any[]): Promise<T[]>;
    close(): Promise<void>;
    /**
     * Returns true if the underlying database connection (MySQL/SQLite) is closed.
     */
    isClosed(): boolean;
    initialize(): Promise<void>;
    showProcessList(print?: boolean): Promise<unknown>;
    /**
     * Check if the checksum of the SQLite database file has changed since the last recorded value.
     *
     * Compares the current checksum of the SQLite database file with the last stored checksum
     * in the `.cache/migrations/` directory. If `save` is true and the checksum has changed,
     * updates the stored checksum file.
     *
     * @param save Whether to update the stored checksum file if the checksum has changed.
     * @returns True if the checksum has changed, false otherwise.
     */
    private isChecksumChanged;
    /**
     * Migrates logs from the SQLite database to the MySQL database for the current database name.
     *
     * Skips logs that already exist in the MySQL database.
     * Uses a lock file in the `.cache/migrations/` directory, named by the checksum of the SQLite file,
     * to prevent duplicate migrations. If the lock file exists, migration is skipped.
     *
     * Only performs migration if the checksum of the SQLite database file has changed since the last migration.
     * After a successful migration, updates the stored checksum file.
     *
     * @returns Promise that resolves when migration is complete or skipped.
     */
    migrate(): Promise<void>;
}

/**
 * Converts an input string into a MySQL-compatible database name.
 *
 * Rules applied:
 * - Replaces non-alphanumeric and non-underscore characters with `_`
 * - Removes leading characters until the name starts with a letter
 * - Truncates result to 64 characters
 * - Returns `default` when input is empty or result becomes empty
 *
 * @param name - Source database name.
 * @returns Sanitized database name.
 */
declare function toValidMySQLDatabaseName(name: any): any;

type PuppeteerContext = Page | Frame;
/**
 * A wrapper around Puppeteer's Page or Frame that provides a consistent API for common operations,
 * regardless of whether the underlying context is a Page or a Frame. This allows the rest of the codebase
 * to interact with a single PageContext type without worrying about the specific Puppeteer context type.
 */
declare class PageContext {
    private readonly context;
    private readonly rootPage?;
    constructor(context: PuppeteerContext, rootPage?: Page);
    static fromPage(page: Page): PageContext;
    static fromFrame(frame: Frame, page?: Page): PageContext;
    get raw(): PuppeteerContext;
    get page(): Page | undefined;
    waitForSelector(selector: string, options?: WaitForSelectorOptions): Promise<puppeteer_core.ElementHandle<Element>>;
    $(selector: string): Promise<puppeteer_core.ElementHandle<Element>>;
    $$(selector: string): Promise<puppeteer_core.ElementHandle<Element>[]>;
    $eval<Selector extends string, Params extends unknown[], Func extends (...args: any[]) => any>(selector: Selector, pageFunction: Func, ...args: Params): Promise<any>;
    $$eval<Selector extends string, Params extends unknown[], Func extends (...args: any[]) => any>(selector: Selector, pageFunction: Func, ...args: Params): Promise<any>;
    click(selector: string, options?: any): Promise<void>;
    focus(selector: string): Promise<void>;
    hover(selector: string): Promise<void>;
    tap(selector: string): Promise<void>;
    type(selector: string, text: string, options?: {
        delay?: number;
    }): Promise<void>;
    evaluate<Params extends unknown[], Func extends (...args: any[]) => any>(pageFunction: Func, ...args: Params): Promise<any>;
    evaluateHandle<Params extends unknown[], Func extends (...args: any[]) => any>(pageFunction: Func, ...args: Params): Promise<JSHandle>;
    waitForFunction<Params extends unknown[], Func extends (...args: any[]) => any>(pageFunction: Func, options?: any, ...args: Params): Promise<puppeteer_core.ElementHandle<any> | JSHandle<any>>;
    waitForTimeout(ms: number): Promise<void>;
    content(): Promise<string>;
    title(): Promise<string>;
    url(): string;
    locator(selector: string): puppeteer_core.Locator<Element>;
    select(selector: string, ...values: string[]): Promise<string[]>;
    xpath(xpath: string): Promise<puppeteer_core.ElementHandle<Element>>;
    exists(selector: string): Promise<boolean>;
    visible(selector: string): Promise<boolean>;
    scrollIntoView(selector: string): Promise<void>;
    getValue(selector: string): Promise<string>;
    getText(selector: string): Promise<string>;
    keyboard(): puppeteer_core.Keyboard;
    mouse(): puppeteer_core.Mouse;
    press(key: KeyInput): Promise<void>;
    browser(): Browser | undefined;
}

/**
 * Creates a PageContext for the given page and optional iframe selector.
 * @param page The Puppeteer Page instance to create the context from.
 * @param iframeSelector Optional CSS selector for an iframe within the page. If provided, the context will be created for the iframe's content frame instead of the main page.
 * @returns A Promise that resolves to a PageContext instance representing either the main page or the specified iframe context.
 * @throws Will throw an error if the iframe selector is provided but the iframe cannot be accessed.
 *
 * @example
 *  const ctx = await createContext(page, '#skrining-frame');
    await ctx.waitForSelector('#nik');
    await ctx.type('#nik', nik);
    await ctx.press('Tab');
    const name = await ctx.getValue(
      'input[name="nama_peserta"]'
    );
    const visible = await ctx.visible('#save');
    await ctx.click('#save');
 */
declare function createContext(page: Page, iframeSelector?: string): Promise<PageContext>;

declare class Cookies {
    constructor(id?: string, profileDir?: string);
    id: string;
    profileDir: string;
    getFilePath(): string;
    /**
     * Load cookies into Puppeteer page
     * @param {import('puppeteer').Page} page
     * @param {object} options
     * @returns {Promise<boolean>}
     */
    load(page: puppeteer.Page, options?: object): Promise<boolean>;
    /**
     * Save cookies from Puppeteer page
     * @param {import('puppeteer').Page} page
     * @param {object} options
     * @returns {Promise<string>} file path
     */
    save(page: puppeteer.Page, options?: object): Promise<string>;
    /**
     * Clear cookies file
     * @returns {Promise<boolean>}
     */
    clear(): Promise<boolean>;
    /**
     * Read cookies data from file (no page interaction)
     * @returns {Promise<Array|false>} cookies array or false if not found/invalid
     */
    read(): Promise<any[] | false>;
}

/**
 * Checks if an element matching the selector exists and is visible on the page.
 *
 * @param {import('puppeteer').Page} page - Puppeteer Page instance
 * @param {string} selector - CSS selector for the element to check
 * @returns {Promise<boolean>} Resolves to true if the element exists and is visible, false otherwise
 */
declare function elementExists(page: puppeteer.Page, selector: string): Promise<boolean>;

/**
 * Check if any element matching the selector contains the given text
 *
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector (e.g., "form")
 * @param {string} text - Substring to check inside elements
 * @returns {Promise<boolean>}
 */
declare function elementsContainText(page: puppeteer.Page, selector: string, text: string): Promise<boolean>;

/**
 * Check if an element exists with specific text content and is visible
 *
 * @param {import('puppeteer').Page} page Puppeteer Page object
 * @param {string} selector CSS selector to match elements
 * @param {string} text Text content to match
 * @returns {Promise<boolean>} true if element exists and contains the text
 */
declare function elementWithTextExists(page: puppeteer.Page, selector: string, text: string): Promise<boolean>;

/**
 * Options for filtering fingerprints by screen size.
 * @typedef {Object} FingerprintSizeOptions
 * @property {number|string} [width] Exact width to match
 * @property {number|string} [height] Exact height to match
 * @property {number|string} [minWidth] Minimum width (inclusive)
 * @property {number|string} [minHeight] Minimum height (inclusive)
 * @property {number|string} [maxWidth] Maximum width (inclusive)
 * @property {number|string} [maxHeight] Maximum height (inclusive)
 */
/**
 * Get the fingerprint cache directory based on tags.
 *
 * @param {string[]} [tags] - Tags to include in the cache path
 * @returns {string} Fingerprint cache directory path
 */
declare function getFingerprintCacheDir(tags?: string[]): string;
/**
 * Get all cached fingerprints from the cache directory based on tags.
 * Optionally filter cached fingerprints by screen size constraints.
 *
 * @param {string[]} [tags] - Tags to determine cache directory
 * @param {FingerprintSizeOptions} [sizeOptions] - Optional size constraints (see typedef above)
 * @returns {Promise<string[]>} Array of cached fingerprint file paths, sorted by modification time (newest first)
 */
declare function listCachedFingerprintFiles(tags?: string[], sizeOptions?: FingerprintSizeOptions): Promise<string[]>;
/**
 * Get a random cached fingerprint from the cache directory.
 * Optionally filter cached fingerprints by screen size constraints.
 *
 * @param {string[]} [tags] - Tags to determine cache directory
 * @param {FingerprintSizeOptions} [sizeOptions] - Optional size constraints (see typedef above)
 * @returns {Promise<string|null>} Random cached fingerprint content, or null if none found
 */
declare function getRandomCachedFingerprint(tags?: string[], sizeOptions?: FingerprintSizeOptions): Promise<string | null>;
/**
 * Get the most recently cached fingerprint from the cache directory.
 * Optionally filter by screen size constraints.
 *
 * @param {string[]} [tags] - Tags to determine cache directory
 * @param {FingerprintSizeOptions} [sizeOptions] - Optional size constraints (see typedef above)
 * @returns {Promise<string|null>} Most recent cached fingerprint content, or null if cache is empty
 */
declare function getLatestCachedFingerprint(tags?: string[], sizeOptions?: FingerprintSizeOptions): Promise<string | null>;
/**
 * Save fingerprint content into the cache directory.
 *
 * @param {string} fingerprint - Raw fingerprint JSON string.
 * @param {string[]} [tags] - Tags used to determine cache directory.
 * @returns {string} Saved fingerprint file path.
 */
declare function saveFingerprintToCache(fingerprint: string, tags?: string[]): string;
/**
 * Fetch a new fingerprint and save it into the cache directory.
 *
 * @param {string[]|import('puppeteer-with-fingerprints').FetchOptions} [tagsOrOption] - Tags used when fetching and storing fingerprint.
 * @returns {Promise<{ fingerprint: string, filePath: string | null } | null>} Fetched fingerprint and cache path, or null on failure.
 */
declare function fetchAndSaveFingerprintToCache(tagsOrOption?: string[] | puppeteer_with_fingerprints.FetchOptions): Promise<{
    fingerprint: string;
    filePath: string | null;
} | null>;
/**
 * Parse screen size information.
 * Accepts either a data object, a file path to a JSON file, or a JSON string.
 * If a file path is provided, the file will be read and parsed before processing.
 *
 * @param {object|string} data - Data object, JSON string, or filesystem path to JSON file
 * @returns {object|null} Parsed screen size info or null on failure
 */
declare function parseScreenSize(data: object | string): object | null;
/**
 * Options for filtering fingerprints by screen size.
 */
type FingerprintSizeOptions = {
    /**
     * Exact width to match
     */
    width?: number | string;
    /**
     * Exact height to match
     */
    height?: number | string;
    /**
     * Minimum width (inclusive)
     */
    minWidth?: number | string;
    /**
     * Minimum height (inclusive)
     */
    minHeight?: number | string;
    /**
     * Maximum width (inclusive)
     */
    maxWidth?: number | string;
    /**
     * Maximum height (inclusive)
     */
    maxHeight?: number | string;
};

/**
 * Return the currently active/focused Page in a Browser, if detectable.
 *
 * This attempts to evaluate `document.hasFocus()` in each open page and
 * returns the first page that reports focus. If none report focus, it
 * falls back to the last opened page or null if no pages exist.
 *
 * @param {import('puppeteer').Browser} browser
 * @returns {Promise<import('puppeteer').Page|null>}
 */
declare function getActivePage(browser: puppeteer.Browser): Promise<puppeteer.Page | null>;

/**
 * Extracts attribute values and common properties from input and textarea elements.
 *
 * NOTE: This function is executed inside the browser context (for example via `$$eval`).
 * It returns plain JSON-serializable objects and must not rely on external variables or
 * runtime helpers.
 *
 * @param {HTMLInputElement[]|HTMLTextAreaElement[]} elements - Array of input or textarea elements from the DOM.
 * @returns {Array<Object>} Array of plain objects with attributes and common properties.
 */
declare function extractFormValues(elements: HTMLInputElement[] | HTMLTextAreaElement[]): Array<any>;
/**
 * Get values of all input and textarea elements within a container inside an iframe.
 *
 * @param {import('puppeteer').Page} page - The Puppeteer page instance.
 * @param {string} iframeSelector - The CSS selector for the iframe.
 * @param {string} containerSelector - The CSS selector for the container inside the iframe.
 * @returns {Promise<Array<Object>>}
 */
declare function getFormValuesFromFrame(page: puppeteer.Page, iframeSelector: string, containerSelector: string): Promise<Array<any>>;

/**
 * Navigate a Puppeteer `page` to `url` with retries and exponential backoff.
 * @param {import('puppeteer').Page} page
 * @param {string} url
 * @param {object} [opts]
 * @param {number} [opts.retries=3] - Number of retry attempts (not counting the first try).
 * @param {number} [opts.timeout=30000] - Navigation timeout in ms.
 * @param {string|string[]} [opts.waitUntil='networkidle2'] - Puppeteer waitUntil option.
 * @param {import('./Cookies.js').PuppeteerCookies} [opts.cookie] - Optional PuppeteerCookies instance to load cookies before navigation.
 * @param {number} [opts.retryDelay=1000] - Initial delay in ms between retries (exponential backoff).
 * @param {function} [opts.onRetry] - Optional callback called before each retry with {attempt, err, delay}.
 * @returns {Promise<import('puppeteer').HTTPResponse|null>}
 */
declare function goWithRetry(page: puppeteer.Page, url: string, opts?: {
    retries?: number;
    timeout?: number;
    waitUntil?: string | string[];
    cookie?: Cookies;
    retryDelay?: number;
    onRetry?: Function;
}): Promise<puppeteer.HTTPResponse | null>;

/**
 * Connects to a Puppeteer endpoint using EndpointManager.
 * Finds a free endpoint, claims it exclusively for the current process,
 * connects to it, performs a sample navigation, and then releases the claim.
 *
 * @returns Resolves when the connection and operations complete, or returns undefined if an endpoint could not be claimed.
 */
declare function connectEndpoint(): Promise<{
    release: () => void;
    browser: puppeteer_core.Browser;
}>;

/**
 * Global shared directory for endpoint data, nested under {@link GLOBAL_PUPPETEER_DIR}.
 */
declare const GLOBAL_ENDPOINT_MANAGER_PATH: string;
declare class EndpointManager {
    /** Directory path for endpoint data. */
    basePath: string;
    /** Path to the JSON file holding all registered endpoints. */
    endpointFile: string;
    /** Directory path for per-endpoint lock files. */
    endpointLocksPath: string;
    /**
     * @param basePath - Directory to store endpoint data. Defaults to a
     *   fixed path under `os.tmpdir()` so all processes share the same
     *   endpoint registry regardless of their working directory.
     */
    private endpointAvailabilityCache;
    constructor(basePath?: string);
    clearAvailabilityCache(): void;
    /**
     * Parse raw file content into an array of endpoint strings.
     * @param content - Raw JSON string from the endpoint file.
     */
    private parseEndpoints;
    /**
     * Build the filesystem path for the lock file of a given endpoint.
     * @param endpoint - The browser WebSocket endpoint URL.
     */
    private getEndpointLockPath;
    /**
     * Read and parse the lock file for an endpoint.
     * Returns `undefined` if the file does not exist or is unreadable.
     * @param endpoint - The browser WebSocket endpoint URL.
     */
    private readEndpointLock;
    /**
     * Check whether a given PID is still alive.
     * Uses `process.kill(pid, 0)` which tests existence without sending a signal.
     * @param pid - Process ID to check.
     */
    private isProcessRunning;
    /**
     * Return the lock for an endpoint if it exists and its owner is still alive.
     * Stale locks are cleaned up automatically.
     * @param endpoint - The browser WebSocket endpoint URL.
     */
    private getActiveEndpointLock;
    /**
     * Check whether an endpoint has a live (non-stale) lock.
     * @param endpoint - The browser WebSocket endpoint URL.
     */
    isEndpointLocked(endpoint: string): boolean;
    /**
     * Read all registered endpoint URLs from the shared JSON file.
     * Returns an empty array when the file does not exist yet or is unreadable.
     */
    readEndpoints(): string[];
    /**
     * Register an endpoint URL in the shared JSON file (deduplicated).
     * @param endpoint - The browser WebSocket endpoint URL to register.
     */
    writeEndpoint(endpoint: string): void;
    /**
     * Remove an endpoint URL from the shared registry and delete its lock file.
     * @param endpoint - The browser WebSocket endpoint URL to remove.
     */
    removeEndpoint(endpoint: string): void;
    /**
     * Checks if a Puppeteer endpoint is available by attempting Puppeteer.connect.
     */
    private isPuppeteerEndpointAvailable;
    /**
     * Returns the first available endpoint (not locked, not stale, and Puppeteer responds)
     */
    getAvailableEndpoint(): Promise<string | undefined>;
    /**
     * Returns all endpoints with their lock status, inactive status, and Puppeteer availability
     */
    getAllActiveEndpoints(): Promise<Array<{
        endpoint: string;
        locked: boolean;
        inactive: boolean;
        ownerPid: number | null;
        claimedAt: string | null;
        puppeteerAvailable: boolean;
    }>>;
    /**
     * Atomically claim an endpoint lock for a given process.
     * Fails if the endpoint is already locked by a different alive process.
     * @param endpoint - The browser WebSocket endpoint URL.
     * @param ownerPid - PID of the claiming process.
     * @returns `true` when the lock was acquired, `false` if already claimed.
     */
    tryClaimEndpoint(endpoint: string, ownerPid: number): boolean;
    /**
     * Release a claim on an endpoint. Only succeeds if the caller is the
     * current owner or the owning process is no longer alive.
     * @param endpoint - The browser WebSocket endpoint URL.
     * @param ownerPid - PID that originally claimed the endpoint.
     */
    releaseEndpointClaim(endpoint: string, ownerPid: number): void;
    /**
     * Return the current lock status for every registered endpoint.
     * Does not perform a Puppeteer reachability check.
     */
    readEndpointStatus(): {
        endpoint: string;
        inUse: boolean;
        ownerPid: number;
    }[];
}

/**
 * Acquire a Puppeteer `page` and `browser` connected to an available shared browser endpoint.
 *
 * This function will try to claim an available endpoint via the local `EndpointManager`,
 * connect using `getPuppeteer`, and return the connected `page` and `browser` together with
 * the managing `endpointManager`, the claimed `endpoint` string, and a `release` helper to
 * free the claim (and optionally close the browser) when finished.
 *
 * @async
 * @param options Optional options forwarded to `getPuppeteer` (e.g. for puppeteer.connect).
 * @returns An object: `{ page, browser, endpoint, endpointManager, release }`.
 */
declare function getPuppeteerWithParallel(options?: {}): Promise<{
    page: puppeteer_core.Page;
    browser: puppeteer_core.Browser;
    endpoint: string;
    endpointManager: EndpointManager;
    release: (closeBrowser?: boolean) => Promise<void>;
}>;

interface GotoOptions {
    retries?: number;
    timeout?: number;
    waitUntil?: string | string[];
    cookie?: Cookies;
    retryDelay?: number;
    onRetry?: Function;
    url?: string;
}
declare function useDefault(): Promise<{
    browser: rebrowser_puppeteer_core.Browser;
    goto: (pageOrUrl: any, url?: string | GotoOptions, options?: GotoOptions) => Promise<puppeteer_core.HTTPResponse>;
}>;
/**
 * Launches a Puppeteer browser instance in the background for parallel usage.
 *
 * Opens a maximized browser with stealth mode enabled, navigates to the
 * initial URL, and sets up target lifecycle listeners (`targetcreated`,
 * `targetdestroyed`, `targetchanged`) that refresh the shared WebSocket
 * endpoint file whenever targets change.
 *
 * After the browser is ready the function:
 * - Writes the browser's WebSocket endpoint so other processes can connect
 * - Removes stale/unavailable endpoints from the registry
 * - Creates a PID-based running-indicator file under `GLOBAL_PUPPETEER_DIR`
 *
 * The returned promise never resolves — it keeps the process alive until the
 * browser disconnects or the process receives `SIGINT`, `SIGTERM`, or `exit`,
 * at which point the endpoint is cleaned up.
 */
declare function parallelLauncher(): Promise<void>;

declare const endpointManager: EndpointManager;
/**
 * Spawns a detached child process that runs the Puppeteer launcher
 * (`launcher.runner.ts` or its compiled `.js` counterpart).
 *
 * Waits up to 60 seconds for a running-indicator file to appear under
 * `GLOBAL_PUPPETEER_DIR`. Throws if the child exits prematurely or the
 * timeout is exceeded.
 *
 * @returns A promise that resolves once the browser process signals it is ready
 */
declare function launch(): Promise<void>;
/**
 * Connects to an available Puppeteer browser endpoint.
 *
 * Queries the {@link endpointManager} for active endpoints. If none exist, or
 * no free endpoint can be claimed, a new browser is launched automatically via
 * {@link launch}.
 *
 * The function loops until it can claim an unlocked, Puppeteer-responsive
 * endpoint. Dead endpoints (`ECONNREFUSED`) are removed from the registry
 * transparently. Once a connection is established a `disconnected` listener
 * releases the claim.
 *
 * @returns A promise that resolves with a connected {@link Browser} instance
 * @throws If no endpoint can be obtained after repeated launch attempts
 */
declare function connect(): Promise<Browser>;

/**
 * Processes screening data, reusing existing screenshots when possible and fetching new ones when needed.
 */
declare function parallelSkrinCheck(options?: {
    specificNiks?: string[];
    force?: boolean;
    openScreenshots?: boolean;
    limit?: number;
    fromDate?: string;
    toDate?: string;
}): Promise<void>;
declare const parallelSkrinCheckEndpointManager: EndpointManager;
declare function getParallelSkrinCheckClaimedEndpoint(): string;

declare function parallelSkrin(opts: {
    loop?: boolean;
    randomize?: boolean;
    max?: number;
    argv: Record<string, any>;
}): Promise<void>;

/**
 * Checks whether a Chromium user data directory appears to be in use.
 *
 * @param {string} targetUserDataDir - User data directory path to check.
 * @returns {boolean}
 */
declare function isUserDataDirInUse(targetUserDataDir: string): boolean;
/**
 * Returns the first available fallback profile directory path.
 *
 * @param {number} [startIndex=1] - First profile index to probe.
 * @param {string[]} [excludedDirs=[]] - Directories to skip when selecting fallback profile.
 * @returns {string}
 */
declare function getFallbackProfileDir(startIndex?: number, excludedDirs?: string[]): string;
/**
 * Global shared temp directory for all puppeteer parallel data, using the
 * OS temp folder so that all processes (regardless of working directory)
 * share the same state.
 */
declare const GLOBAL_PUPPETEER_DIR: string;
/**
 * Global shared directory for browser profile data, using the OS temp folder so
 * that all processes (regardless of working directory) share the same profiles.
 */
declare const GLOBAL_PROFILES_DIR: string;
/**
 * @param {Object} params
 * @param {{ userDataDir?: string }} params.launchOptions - Puppeteer launch options object.
 * @param {boolean} params.autoSwitchProfileDir - Whether to fall back to another profile dir if preferred is busy.
 * @returns {{ currentLaunchOptions: { userDataDir?: string }, excludedUserDataDirs: Set<string> }}
 */
declare function prepareLaunchOptionsWithProfileFallback({ launchOptions, autoSwitchProfileDir }: {
    launchOptions: {
        userDataDir?: string;
    };
    autoSwitchProfileDir: boolean;
}): {
    currentLaunchOptions: {
        userDataDir?: string;
    };
    excludedUserDataDirs: Set<string>;
};
/**
 * @param {Set<string>} excludedUserDataDirs
 * @param {number} [startIndex=1]
 * @returns {string}
 */
declare function reserveNextFallbackProfileDir(excludedUserDataDirs: Set<string>, startIndex?: number): string;
/**
 * @param {Object} params
 * @param {(launchOptions: { userDataDir?: string }) => Promise<any>} params.launchFn - Function that performs the actual browser launch.
 * @param {{ userDataDir?: string }} params.launchOptions - Puppeteer launch options object.
 * @param {boolean} params.autoSwitchProfileDir - Whether to fall back to another profile dir if preferred is busy.
 * @param {string} params.launcherName - Name of the launcher (for logging).
 * @param {number} [params.maxFallbackLaunchAttempts=10] - Max retries if profile dir is in use.
 * @returns {Promise<any>}
 */
declare function launchWithProfileFallback({ launchFn, launchOptions, autoSwitchProfileDir, launcherName, maxFallbackLaunchAttempts }: {
    launchFn: (launchOptions: {
        userDataDir?: string;
    }) => Promise<any>;
    launchOptions: {
        userDataDir?: string;
    };
    autoSwitchProfileDir: boolean;
    launcherName: string;
    maxFallbackLaunchAttempts?: number;
}): Promise<any>;
/**
 * @param {Object} params
 * @param {string} params.preferredUserDataDir
 * @param {Set<string>} params.reservedUserDataDirs
 * @param {boolean} params.autoSwitchProfileDir
 * @param {number} [params.fallbackProfileStartIndex=1]
 * @returns {string}
 */
declare function reserveClusterUserDataDir({ preferredUserDataDir, reservedUserDataDirs, autoSwitchProfileDir, fallbackProfileStartIndex }: {
    preferredUserDataDir: string;
    reservedUserDataDirs: Set<string>;
    autoSwitchProfileDir: boolean;
    fallbackProfileStartIndex?: number;
}): string;

/**
 * Triggers 'input' and 'change' events on an input or textarea element,
 * optionally within an iframe. Does NOT change the element’s value.
 *
 * @param {import('puppeteer').Page} page - Puppeteer Page object
 * @param {string} selector - CSS selector for the input or textarea
 * @param {Object} [options]
 * @param {string} [options.frameSelector] - Optional iframe CSS selector
 * @param {string} [options.frameName] - Optional iframe name
 */
declare function triggerInputChange(page: puppeteer.Page, selector: string, options?: {
    frameSelector?: string;
    frameName?: string;
}): Promise<void>;

declare function setupXhrCapture(page: Page, opts?: {
    baseDir?: string;
}): () => Promise<void>;

type ie_AddLogOptions = AddLogOptions;
type ie_EndpointManager = EndpointManager;
declare const ie_EndpointManager: typeof EndpointManager;
type ie_FingerprintSizeOptions = FingerprintSizeOptions;
declare const ie_GLOBAL_ENDPOINT_MANAGER_PATH: typeof GLOBAL_ENDPOINT_MANAGER_PATH;
declare const ie_GLOBAL_PROFILES_DIR: typeof GLOBAL_PROFILES_DIR;
declare const ie_GLOBAL_PUPPETEER_DIR: typeof GLOBAL_PUPPETEER_DIR;
type ie_GotoOptions = GotoOptions;
type ie_LoadJSOpt = LoadJSOpt;
type ie_LogDatabase<TDefault = any> = LogDatabase<TDefault>;
declare const ie_LogDatabase: typeof LogDatabase;
type ie_LogDatabaseOptions = LogDatabaseOptions;
type ie_MySQLConfig = MySQLConfig;
type ie_MySQLHelper = MySQLHelper;
declare const ie_MySQLHelper: typeof MySQLHelper;
type ie_MysqlLogDatabase = MysqlLogDatabase;
declare const ie_MysqlLogDatabase: typeof MysqlLogDatabase;
type ie_PageContext = PageContext;
declare const ie_PageContext: typeof PageContext;
type ie_PuppeteerContext = PuppeteerContext;
type ie_SQLiteLogDatabase = SQLiteLogDatabase;
declare const ie_SQLiteLogDatabase: typeof SQLiteLogDatabase;
declare const ie_connect: typeof connect;
declare const ie_connectEndpoint: typeof connectEndpoint;
declare const ie_containsMonth: typeof containsMonth;
declare const ie_createContext: typeof createContext;
declare const ie_elementExists: typeof elementExists;
declare const ie_elementWithTextExists: typeof elementWithTextExists;
declare const ie_elementsContainText: typeof elementsContainText;
declare const ie_endpointManager: typeof endpointManager;
declare const ie_enforceDateFormat: typeof enforceDateFormat;
declare const ie_extractFormValues: typeof extractFormValues;
declare const ie_extractMonthName: typeof extractMonthName;
declare const ie_extractNumericWithComma: typeof extractNumericWithComma;
declare const ie_fetchAndSaveFingerprintToCache: typeof fetchAndSaveFingerprintToCache;
declare const ie_getActivePage: typeof getActivePage;
declare const ie_getAge: typeof getAge;
declare const ie_getAgeFromDateString: typeof getAgeFromDateString;
declare const ie_getDatabaseFilePath: typeof getDatabaseFilePath;
declare const ie_getDatesWithoutSundays: typeof getDatesWithoutSundays;
declare const ie_getFallbackProfileDir: typeof getFallbackProfileDir;
declare const ie_getFingerprintCacheDir: typeof getFingerprintCacheDir;
declare const ie_getFormValuesFromFrame: typeof getFormValuesFromFrame;
declare const ie_getLatestCachedFingerprint: typeof getLatestCachedFingerprint;
declare const ie_getNumbersOnly: typeof getNumbersOnly;
declare const ie_getParallelSkrinCheckClaimedEndpoint: typeof getParallelSkrinCheckClaimedEndpoint;
declare const ie_getPuppeteerWithParallel: typeof getPuppeteerWithParallel;
declare const ie_getRandomCachedFingerprint: typeof getRandomCachedFingerprint;
declare const ie_getWeekdaysOfCurrentMonth: typeof getWeekdaysOfCurrentMonth;
declare const ie_goWithRetry: typeof goWithRetry;
declare const ie_isUserDataDirInUse: typeof isUserDataDirInUse;
declare const ie_launch: typeof launch;
declare const ie_launchWithProfileFallback: typeof launchWithProfileFallback;
declare const ie_listCachedFingerprintFiles: typeof listCachedFingerprintFiles;
declare const ie_loadJS: typeof loadJS;
declare const ie_multiBeep: typeof multiBeep;
declare const ie_noop: typeof noop;
declare const ie_parallelLauncher: typeof parallelLauncher;
declare const ie_parallelSkrin: typeof parallelSkrin;
declare const ie_parallelSkrinCheck: typeof parallelSkrinCheck;
declare const ie_parallelSkrinCheckEndpointManager: typeof parallelSkrinCheckEndpointManager;
declare const ie_parseDate: typeof parseDate;
declare const ie_parseScreenSize: typeof parseScreenSize;
declare const ie_prepareLaunchOptionsWithProfileFallback: typeof prepareLaunchOptionsWithProfileFallback;
declare const ie_randomStr: typeof randomStr;
declare const ie_reserveClusterUserDataDir: typeof reserveClusterUserDataDir;
declare const ie_reserveNextFallbackProfileDir: typeof reserveNextFallbackProfileDir;
declare const ie_saveFingerprintToCache: typeof saveFingerprintToCache;
declare const ie_setupXhrCapture: typeof setupXhrCapture;
declare const ie_singleBeep: typeof singleBeep;
declare const ie_sleep: typeof sleep;
declare const ie_stripProtocol: typeof stripProtocol;
declare const ie_toValidMySQLDatabaseName: typeof toValidMySQLDatabaseName;
declare const ie_triggerInputChange: typeof triggerInputChange;
declare const ie_uniqueArrayObjByKey: typeof uniqueArrayObjByKey;
declare const ie_useDefault: typeof useDefault;
declare namespace ie {
  export { ie_EndpointManager as EndpointManager, ie_GLOBAL_ENDPOINT_MANAGER_PATH as GLOBAL_ENDPOINT_MANAGER_PATH, ie_GLOBAL_PROFILES_DIR as GLOBAL_PROFILES_DIR, ie_GLOBAL_PUPPETEER_DIR as GLOBAL_PUPPETEER_DIR, ie_LogDatabase as LogDatabase, ie_MySQLHelper as MySQLHelper, ie_MysqlLogDatabase as MysqlLogDatabase, ie_PageContext as PageContext, Cookies as PuppeteerCookies, ie_SQLiteLogDatabase as SQLiteLogDatabase, ie_connect as connect, ie_connectEndpoint as connectEndpoint, ie_containsMonth as containsMonth, ie_createContext as createContext, parseDate as dateStringToDDMMYYYY, ie_elementExists as elementExists, ie_elementWithTextExists as elementWithTextExists, ie_elementsContainText as elementsContainText, ie_endpointManager as endpointManager, ie_enforceDateFormat as enforceDateFormat, ie_extractFormValues as extractFormValues, ie_extractMonthName as extractMonthName, ie_extractNumericWithComma as extractNumericWithComma, ie_fetchAndSaveFingerprintToCache as fetchAndSaveFingerprintToCache, ie_getActivePage as getActivePage, ie_getAge as getAge, ie_getAgeFromDateString as getAgeFromDateString, ie_getDatabaseFilePath as getDatabaseFilePath, ie_getDatesWithoutSundays as getDatesWithoutSundays, ie_getFallbackProfileDir as getFallbackProfileDir, ie_getFingerprintCacheDir as getFingerprintCacheDir, ie_getFormValuesFromFrame as getFormValuesFromFrame, ie_getLatestCachedFingerprint as getLatestCachedFingerprint, ie_getNumbersOnly as getNumbersOnly, ie_getParallelSkrinCheckClaimedEndpoint as getParallelSkrinCheckClaimedEndpoint, ie_getPuppeteerWithParallel as getPuppeteerWithParallel, ie_getRandomCachedFingerprint as getRandomCachedFingerprint, ie_getWeekdaysOfCurrentMonth as getWeekdaysOfCurrentMonth, ie_goWithRetry as goWithRetry, ie_isUserDataDirInUse as isUserDataDirInUse, ie_launch as launch, ie_launchWithProfileFallback as launchWithProfileFallback, ie_listCachedFingerprintFiles as listCachedFingerprintFiles, ie_loadJS as loadJS, ie_multiBeep as multiBeep, defaultOptions as mysqlDefaultOptions, ie_noop as noop, ie_parallelLauncher as parallelLauncher, ie_parallelSkrin as parallelSkrin, ie_parallelSkrinCheck as parallelSkrinCheck, ie_parallelSkrinCheckEndpointManager as parallelSkrinCheckEndpointManager, ie_parseDate as parseDate, ie_parseScreenSize as parseScreenSize, ie_prepareLaunchOptionsWithProfileFallback as prepareLaunchOptionsWithProfileFallback, ie_randomStr as randomStr, ie_reserveClusterUserDataDir as reserveClusterUserDataDir, ie_reserveNextFallbackProfileDir as reserveNextFallbackProfileDir, ie_saveFingerprintToCache as saveFingerprintToCache, ie_setupXhrCapture as setupXhrCapture, ie_singleBeep as singleBeep, ie_sleep as sleep, ie_stripProtocol as stripProtocol, ie_toValidMySQLDatabaseName as toValidMySQLDatabaseName, ie_triggerInputChange as triggerInputChange, ie_uniqueArrayObjByKey as uniqueArrayObjByKey, ie_useDefault as useDefault };
  export type { ie_AddLogOptions as AddLogOptions, ie_FingerprintSizeOptions as FingerprintSizeOptions, ie_GotoOptions as GotoOptions, ie_LoadJSOpt as LoadJSOpt, ie_LogDatabaseOptions as LogDatabaseOptions, ie_MySQLConfig as MySQLConfig, ie_PuppeteerContext as PuppeteerContext };
}

export { EndpointManager, GLOBAL_ENDPOINT_MANAGER_PATH, GLOBAL_PROFILES_DIR, GLOBAL_PUPPETEER_DIR, LogDatabase, MySQLHelper, MysqlLogDatabase, PageContext, Cookies as PuppeteerCookies, SQLiteLogDatabase, connect, connectEndpoint, containsMonth, createContext, parseDate as dateStringToDDMMYYYY, ie as default, elementExists, elementWithTextExists, elementsContainText, endpointManager, enforceDateFormat, extractFormValues, extractMonthName, extractNumericWithComma, fetchAndSaveFingerprintToCache, getActivePage, getAge, getAgeFromDateString, getDatabaseFilePath, getDatesWithoutSundays, getFallbackProfileDir, getFingerprintCacheDir, getFormValuesFromFrame, getLatestCachedFingerprint, getNumbersOnly, getParallelSkrinCheckClaimedEndpoint, getPuppeteerWithParallel, getRandomCachedFingerprint, getWeekdaysOfCurrentMonth, goWithRetry, isUserDataDirInUse, launch, launchWithProfileFallback, listCachedFingerprintFiles, loadJS, multiBeep, defaultOptions as mysqlDefaultOptions, noop, parallelLauncher, parallelSkrin, parallelSkrinCheck, parallelSkrinCheckEndpointManager, parseDate, parseScreenSize, prepareLaunchOptionsWithProfileFallback, randomStr, reserveClusterUserDataDir, reserveNextFallbackProfileDir, saveFingerprintToCache, setupXhrCapture, singleBeep, sleep, stripProtocol, toValidMySQLDatabaseName, triggerInputChange, uniqueArrayObjByKey, useDefault };
export type { AddLogOptions, FingerprintSizeOptions, GotoOptions, LoadJSOpt, LogDatabaseOptions, MySQLConfig, PuppeteerContext };
