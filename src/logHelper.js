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
 * Add a log entry
 * @param {{id: string, data: any, message: string}} param0
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
 * Remove a log entry by id
 * @param {string} id
 */
export function removeLog(id) {
  const info = db.prepare('DELETE FROM logs WHERE id = ?').run(id);
  return info.changes > 0;
}

/**
 * Get a log entry by id
 * @param {string} id
 * @returns {object | undefined}
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
 * Get all logs or filtered logs
 * @param {(log: object) => boolean} [filterFn]
 * @returns {Array}
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
