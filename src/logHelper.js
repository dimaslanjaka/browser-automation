import Database from 'better-sqlite3';
import moment from 'moment-timezone';
import path from 'path';
import { jsonParseWithCircularRefs, jsonStringifyWithCircularRefs } from 'sbg-utility';

const dbPath = path.resolve('.cache/logs.db');
const db = new Database(dbPath);

// Create table if not exists
db.prepare(
  `CREATE TABLE IF NOT EXISTS logs (
    id TEXT PRIMARY KEY,
    data TEXT,
    message TEXT,
    timestamp TEXT
  )`
).run();

/**
 * Add a log entry to the database.
 *
 * @param {Object} param0 - Log entry object.
 * @param {string} param0.id - Unique log identifier.
 * @param {any} param0.data - Log data (can be any type, supports circular refs).
 * @param {string} param0.message - Log message.
 */
export function addLog({ id, data, message }) {
  const timestamp = moment().tz('Asia/Jakarta').format('YYYY-MM-DDTHH:mm:ssZ');
  db.prepare(`INSERT OR REPLACE INTO logs (id, data, message, timestamp) VALUES (?, ?, ?, ?)`).run(
    id,
    jsonStringifyWithCircularRefs(data),
    message,
    timestamp
  );
}

/**
 * Remove a log entry by its id.
 *
 * @param {string} id - Unique log identifier.
 * @returns {boolean} True if a log was removed, false otherwise.
 */
export function removeLog(id) {
  const info = db.prepare('DELETE FROM logs WHERE id = ?').run(id);
  return info.changes > 0;
}

/**
 * Get a log entry by its id.
 *
 * @param {string} id - Unique log identifier.
 * @returns {{id: string, data: any, message: string, timestamp: string} | undefined} Log object or undefined if not found.
 */
export function getLogById(id) {
  const row = db.prepare('SELECT * FROM logs WHERE id = ?').get(id);
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
 *
 * @param {function({id: string, data: any, message: string, timestamp: string}): boolean} [filterFn] - Optional filter function to filter logs.
 * @returns {Array<{id: string, data: any, message: string, timestamp: string}>} Array of log objects with keys: id, data, message, timestamp.
 */
export function getLogs(filterFn = () => true) {
  const rows = db.prepare('SELECT * FROM logs').all();
  const logsArr = rows.map((row) => ({
    id: row.id,
    data: jsonParseWithCircularRefs(row.data),
    message: row.message,
    timestamp: row.timestamp
  }));
  return logsArr.filter(filterFn);
}
