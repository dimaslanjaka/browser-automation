import Database from 'better-sqlite3';
import moment from 'moment-timezone';
import path from 'path';
import fs from 'fs';
import { jsonParseWithCircularRefs, jsonStringifyWithCircularRefs } from 'sbg-utility';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Class representing a log database using SQLite.
 */
export class LogDatabase {
  /**
   * Create a new LogDatabase instance.
   * @param {string} [dbFileName] - Optional database filename without extension. Defaults to environment variable DATABASE_FILENAME or 'default'.
   */
  constructor(dbFileName) {
    const name = dbFileName || process.env.DATABASE_FILENAME || 'default';
    const dirPath = path.resolve('.cache');
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });

    const dbPath = path.resolve(dirPath, `${name}.db`);
    this.db = new Database(dbPath);
    this._initializeDatabase();
  }

  /**
   * Initialize the database: set journal mode and create logs table if not exists.
   * @private
   */
  _initializeDatabase() {
    this.db.pragma('journal_mode = WAL');
    this.db
      .prepare(
        `CREATE TABLE IF NOT EXISTS logs (
          id TEXT PRIMARY KEY,
          data TEXT,
          message TEXT,
          timestamp TEXT
        )`
      )
      .run();
  }

  /**
   * Add or update a log entry in the database.
   * @param {{ id: string, data: any, message: string }} log - Log entry object.
   * @param {string} log.id - Unique log identifier.
   * @param {any} log.data - Log data (can be any type, supports circular references).
   * @param {string} log.message - Log message.
   */
  addLog({ id, data, message }) {
    const timestamp = moment().tz('Asia/Jakarta').format('YYYY-MM-DDTHH:mm:ssZ');
    this.db
      .prepare(`INSERT OR REPLACE INTO logs (id, data, message, timestamp) VALUES (?, ?, ?, ?)`)
      .run(id, jsonStringifyWithCircularRefs(data), message, timestamp);
  }

  /**
   * Remove a log entry by its id.
   * @param {string} id - Unique log identifier.
   * @returns {boolean} True if a log was removed, false otherwise.
   */
  removeLog(id) {
    const info = this.db.prepare('DELETE FROM logs WHERE id = ?').run(id);
    return info.changes > 0;
  }

  /**
   * Get a log entry by its id.
   * @param {string} id - Unique log identifier.
   * @returns {{ id: string, data: any, message: string, timestamp: string } | undefined} Log object or undefined if not found.
   */
  getLogById(id) {
    const row = this.db.prepare('SELECT * FROM logs WHERE id = ?').get(id);
    if (!row) return undefined;
    return {
      id: row.id,
      data: jsonParseWithCircularRefs(row.data),
      message: row.message,
      timestamp: row.timestamp
    };
  }

  /**
   * Get all logs or filtered logs from the database.
   * @param {function({ id: string, data: any, message: string, timestamp: string }): boolean} [filterFn] - Optional filter function.
   * @returns {Array<{ id: string, data: any, message: string, timestamp: string }>} Array of log objects.
   */
  getLogs(filterFn = () => true) {
    const rows = this.db.prepare('SELECT * FROM logs').all();
    const logsArr = rows.map((row) => ({
      id: row.id,
      data: jsonParseWithCircularRefs(row.data),
      message: row.message,
      timestamp: row.timestamp
    }));
    return logsArr.filter(filterFn);
  }
}

// Example usage:
// const logDb = new LogDatabase('mydb');
// logDb.addLog({ id: '123', data: { foo: 'bar' }, message: 'Test log' });

// Backward compatibility

// Default singleton instance (similar to old behavior)
const db = new LogDatabase(process.env.DATABASE_FILENAME || 'default');

/**
 * Create a new LogDatabase instance at a custom path.
 * @param {string} dbPath - Custom database filename without extension.
 * @returns {LogDatabase} LogDatabase instance.
 */
export function createLogDatabase(dbPath) {
  return new LogDatabase(dbPath);
}

/* === Re-export old functions for backward compatibility === */

/**
 * Add a log entry (singleton DB).
 * @param {Object} params
 * @param {string} params.id
 * @param {any} params.data
 * @param {string} params.message
 */
export function addLog(params) {
  db.addLog(params);
}

/**
 * Remove a log entry by id (singleton DB).
 * @param {string} id
 * @returns {boolean}
 */
export function removeLog(id) {
  return db.removeLog(id);
}

/**
 * Get a log entry by id (singleton DB).
 * @param {string} id
 */
export function getLogById(id) {
  return db.getLogById(id);
}

/**
 * Get all logs (singleton DB) with optional filter.
 * @param {function({ id: string, data: any, message: string, timestamp: string }): boolean} [filterFn]
 */
export function getLogs(filterFn) {
  return db.getLogs(filterFn);
}
