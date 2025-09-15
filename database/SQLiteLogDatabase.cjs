'use strict';

require('../chunk-4IBVXDKH.cjs');
var Database = require('better-sqlite3');
var cp = require('cross-spawn');
var fs = require('fs-extra');
var moment = require('moment-timezone');
var sbgUtility = require('sbg-utility');
var path = require('upath');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var Database__default = /*#__PURE__*/_interopDefault(Database);
var cp__default = /*#__PURE__*/_interopDefault(cp);
var fs__default = /*#__PURE__*/_interopDefault(fs);
var moment__default = /*#__PURE__*/_interopDefault(moment);
var path__default = /*#__PURE__*/_interopDefault(path);

const cacheDirectoryPath = path__default.default.join(process.cwd(), ".cache");
const backupDirectoryPath = path__default.default.join(cacheDirectoryPath, "database/backup");
function getDatabaseFilePath(name) {
  return path__default.default.resolve(cacheDirectoryPath, `${name}.db`);
}
class SQLiteLogDatabase {
  /**
   * Create a new LogDatabase instance.
   * @param {string} [dbFileName] - Optional database filename without extension. Defaults to environment variable DATABASE_FILENAME or 'default'.
   */
  constructor(dbFileName) {
    const name = dbFileName || process.env.DATABASE_FILENAME || "default";
    if (!fs__default.default.existsSync(cacheDirectoryPath)) fs__default.default.mkdirSync(cacheDirectoryPath, { recursive: true });
    const dbPath = getDatabaseFilePath(name);
    this.dbPath = dbPath;
    this.db = new Database__default.default(dbPath);
    process.on("exit", () => {
      const backupPath = path__default.default.join(
        backupDirectoryPath,
        `${name}-backup-${moment__default.default().tz("Asia/Jakarta").format("YYYYMMDD-HHmmss")}.sql`
      );
      this.backup(backupPath).catch((err) => {
        console.error("Failed to backup database on exit:", err);
      });
    });
  }
  /**
   * Execute a raw SQL query on the underlying SQLite database.
   * @param {string} sql - The SQL query string.
   * @param {any[]} [params] - Optional parameters for the query.
   * @returns {any} The result of the query.
   */
  query(sql, params = []) {
    return this.db.prepare(sql).all(...params);
  }
  /**
   * Close the database connection.
   */
  close() {
    this.db.close();
    this.db = void 0;
  }
  /**
   * Check if the pool is closed.
   * @returns {boolean}
   */
  isClosed() {
    return !this.db;
  }
  /**
   * Backup the SQLite database file to a specified destination (raw SQLite file, not SQL dump).
   * Uses better-sqlite3's native backup method for reliability and performance.
   * @param {string} destPath - The destination file path for the backup (will be a binary SQLite file).
   * @returns {Promise<import('better-sqlite3').BackupMetadata>} Resolves when backup is complete.
   */
  async backup(destPath) {
    fs__default.default.ensureDirSync(path__default.default.dirname(destPath));
    const dumpArgs = [this.dbPath, ".dump"];
    const outStream = fs__default.default.createWriteStream(destPath);
    const env = { ...process.env };
    const binPath = path__default.default.join(process.cwd(), "bin");
    env.PATH = `${binPath};${env.PATH}`;
    const child = cp__default.default("sqlite3", dumpArgs, { stdio: ["ignore", "pipe", "inherit"], env });
    child.stdout.pipe(outStream);
    await new Promise((resolve, reject) => {
      child.on("error", (err) => {
        console.error("Backup failed:", err);
        reject(err);
      });
      child.on("close", (code) => {
        if (code === 0) {
          console.log("Backup completed:", destPath);
          resolve();
        } else {
          const err = new Error(`Backup failed with exit code ${code}`);
          console.error(err);
          reject(err);
        }
      });
    });
    while (await fs__default.default.access(destPath).then(() => false).catch(() => true)) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    let content = await fs__default.default.readFile(destPath, "utf-8");
    content = content.replace("CREATE TABLE logs", "CREATE TABLE IF NOT EXISTS logs");
    await fs__default.default.writeFile(destPath, content, "utf-8");
  }
  /**
   * Initialize the database: set journal mode and create logs table if not exists.
   * @private
   */
  initialize() {
    this.db.pragma("journal_mode = WAL");
    this.db.prepare(
      `CREATE TABLE IF NOT EXISTS logs (
          id TEXT PRIMARY KEY,
          data TEXT,
          message TEXT,
          timestamp TEXT
        )`
    ).run();
  }
  /**
   * Add or update a log entry in the database.
   * @param {import('./BaseLogDatabase').LogEntry} log - Log entry object.
   */
  addLog(log) {
    const timestamp = log.timestamp || moment__default.default().tz("Asia/Jakarta").format("YYYY-MM-DDTHH:mm:ssZ");
    this.db.prepare(`INSERT OR REPLACE INTO logs (id, data, message, timestamp) VALUES (?, ?, ?, ?)`).run(log.id, sbgUtility.jsonStringifyWithCircularRefs(log.data), log.message, timestamp);
  }
  /**
   * Remove a log entry by its id.
   * @param {import('./BaseLogDatabase').LogEntry['id']} id - Unique log identifier.
   * @returns {boolean} True if a log was removed, false otherwise.
   */
  removeLog(id) {
    const info = this.db.prepare("DELETE FROM logs WHERE id = ?").run(id);
    return info.changes > 0;
  }
  /**
   * Get a log entry by its id.
   * @param {import('./BaseLogDatabase').LogEntry['id']} id - Unique log identifier.
   * @returns {import('./BaseLogDatabase').LogEntry | undefined} Log object or undefined if not found.
   */
  getLogById(id) {
    const row = this.db.prepare("SELECT * FROM logs WHERE id = ?").get(id);
    if (!row) return void 0;
    return {
      id: row.id,
      data: sbgUtility.jsonParseWithCircularRefs(row.data),
      message: row.message,
      timestamp: row.timestamp
    };
  }
  /**
   * Get all logs or filtered logs from the database.
   *
   * @param {(log: import('./BaseLogDatabase').LogEntry) => boolean | Promise<boolean>} [filterFn] Optional filter function to apply to each log entry after fetching from the database.
   * @param {Object} [options] Optional pagination options.
   * @param {number} [options.limit] Maximum number of logs to return.
   * @param {number} [options.offset] Number of logs to skip before starting to collect the result set.
   * @returns {Array<import('./BaseLogDatabase').LogEntry>} Array of log objects with shape: { id, data, message, timestamp }.
   */
  getLogs(filterFn = () => true, options = {}) {
    let query = "SELECT * FROM logs";
    const params = [];
    if (options == null ? void 0 : options.limit) {
      query += " LIMIT ?";
      params.push(options.limit);
      if (options.offset) {
        query += " OFFSET ?";
        params.push(options.offset);
      }
    }
    const rows = this.db.prepare(query).all(...params);
    const logsArr = rows.map((row) => ({
      id: row.id,
      data: sbgUtility.jsonParseWithCircularRefs(row.data),
      message: row.message,
      timestamp: row.timestamp
    }));
    return logsArr.filter(filterFn);
  }
}
const db = new SQLiteLogDatabase(process.env.DATABASE_FILENAME || "default");
function createLogDatabase(dbPath) {
  return new SQLiteLogDatabase(dbPath);
}
function backupLogDatabase(destPath) {
  return db.backup(destPath);
}
function addLog(params) {
  db.addLog(params);
}
function removeLog(id) {
  return db.removeLog(id);
}
function getLogById(id) {
  return db.getLogById(id);
}
function getLogs(filterFn) {
  return db.getLogs(filterFn);
}

exports.SQLiteLogDatabase = SQLiteLogDatabase;
exports.addLog = addLog;
exports.backupLogDatabase = backupLogDatabase;
exports.createLogDatabase = createLogDatabase;
exports.getDatabaseFilePath = getDatabaseFilePath;
exports.getLogById = getLogById;
exports.getLogs = getLogs;
exports.removeLog = removeLog;
//# sourceMappingURL=SQLiteLogDatabase.cjs.map
//# sourceMappingURL=SQLiteLogDatabase.cjs.map