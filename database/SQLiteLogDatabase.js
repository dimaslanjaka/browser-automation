import '../chunk-BUSYA2B4.js';
import Database from 'better-sqlite3';
import cp from 'cross-spawn';
import fs from 'fs-extra';
import moment from 'moment-timezone';
import { jsonStringifyWithCircularRefs, jsonParseWithCircularRefs } from 'sbg-utility';
import path from 'upath';

const cacheDirectoryPath = path.join(process.cwd(), ".cache");
const backupDirectoryPath = path.join(cacheDirectoryPath, "database/backup");
function getDatabaseFilePath(name) {
  return path.resolve(cacheDirectoryPath, `${name}.db`);
}
class SQLiteLogDatabase {
  /**
   * Create a new LogDatabase instance.
   * @param {string} [dbFileName] - Optional database filename without extension. Defaults to environment variable DATABASE_FILENAME or 'default'.
   */
  constructor(dbFileName) {
    const name = dbFileName || process.env.DATABASE_FILENAME || "default";
    if (!fs.existsSync(cacheDirectoryPath)) fs.mkdirSync(cacheDirectoryPath, { recursive: true });
    const dbPath = getDatabaseFilePath(name);
    this.dbPath = dbPath;
    this.db = new Database(dbPath);
    process.on("exit", () => {
      const backupPath = path.join(
        backupDirectoryPath,
        `${name}-backup-${moment().tz("Asia/Jakarta").format("YYYYMMDD-HHmmss")}.sql`
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
    fs.ensureDirSync(path.dirname(destPath));
    const dumpArgs = [this.dbPath, ".dump"];
    const outStream = fs.createWriteStream(destPath);
    const env = { ...process.env };
    const binPath = path.join(process.cwd(), "bin");
    env.PATH = `${binPath};${env.PATH}`;
    const child = cp("sqlite3", dumpArgs, { stdio: ["ignore", "pipe", "inherit"], env });
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
    while (await fs.access(destPath).then(() => false).catch(() => true)) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    let content = await fs.readFile(destPath, "utf-8");
    content = content.replace("CREATE TABLE logs", "CREATE TABLE IF NOT EXISTS logs");
    await fs.writeFile(destPath, content, "utf-8");
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
    const timestamp = log.timestamp || moment().tz("Asia/Jakarta").format("YYYY-MM-DDTHH:mm:ssZ");
    this.db.prepare(`INSERT OR REPLACE INTO logs (id, data, message, timestamp) VALUES (?, ?, ?, ?)`).run(log.id, jsonStringifyWithCircularRefs(log.data), log.message, timestamp);
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
      data: jsonParseWithCircularRefs(row.data),
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
      data: jsonParseWithCircularRefs(row.data),
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

export { SQLiteLogDatabase, addLog, backupLogDatabase, createLogDatabase, getDatabaseFilePath, getLogById, getLogs, removeLog };
//# sourceMappingURL=SQLiteLogDatabase.js.map
//# sourceMappingURL=SQLiteLogDatabase.js.map