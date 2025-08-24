import Database from 'better-sqlite3';
import cp from 'cross-spawn';
import fs from 'fs-extra';
import moment from 'moment-timezone';
import { jsonParseWithCircularRefs, jsonStringifyWithCircularRefs } from 'sbg-utility';
import path from 'upath';

const cacheDirectoryPath = path.join(process.cwd(), '.cache');
const backupDirectoryPath = path.join(cacheDirectoryPath, 'database/backup');

/**
 * Class representing a log database using SQLite.
 */
export class SQLiteLogDatabase {
  /**
   * Create a new LogDatabase instance.
   * @param {string} [dbFileName] - Optional database filename without extension. Defaults to environment variable DATABASE_FILENAME or 'default'.
   */
  constructor(dbFileName) {
    const name = dbFileName || process.env.DATABASE_FILENAME || 'default';
    if (!fs.existsSync(cacheDirectoryPath)) fs.mkdirSync(cacheDirectoryPath, { recursive: true });

    const dbPath = path.resolve(cacheDirectoryPath, `${name}.db`);
    this.dbPath = dbPath;
    this.db = new Database(dbPath);
    this._initializeDatabase();

    // Auto run backup on process exit
    process.on('exit', () => {
      const backupPath = path.join(
        backupDirectoryPath,
        `${name}-backup-${moment().tz('Asia/Jakarta').format('YYYYMMDD-HHmmss')}.sql`
      );
      this.backup(backupPath).catch((err) => {
        console.error('Failed to backup database on exit:', err);
      });
    });
  }

  /**
   * Close the database connection.
   */
  close() {
    this.db.close();
  }

  /**
   * Backup the SQLite database file to a specified destination (raw SQLite file, not SQL dump).
   * Uses better-sqlite3's native backup method for reliability and performance.
   * @param {string} destPath - The destination file path for the backup (will be a binary SQLite file).
   * @returns {Promise<import('better-sqlite3').BackupMetadata>} Resolves when backup is complete.
   */
  async backup(destPath) {
    fs.ensureDirSync(path.dirname(destPath));
    // Use cross-spawn to run sqlite3 and dump the database
    const dumpArgs = [this.dbPath, '.dump'];
    const outStream = fs.createWriteStream(destPath);
    // Add process.cwd() + '/bin' to PATH for sqlite3 lookup
    const env = { ...process.env };
    const binPath = path.join(process.cwd(), 'bin');
    env.PATH = `${binPath};${env.PATH}`;
    const child = cp('sqlite3', dumpArgs, { stdio: ['ignore', 'pipe', 'inherit'], env });
    child.stdout.pipe(outStream);
    await new Promise((resolve, reject) => {
      child.on('error', (err) => {
        console.error('Backup failed:', err);
        reject(err);
      });
      child.on('close', (code) => {
        if (code === 0) {
          console.log('Backup completed:', destPath);
          resolve();
        } else {
          const err = new Error(`Backup failed with exit code ${code}`);
          console.error(err);
          reject(err);
        }
      });
    });
    // Wait for file to be accessible
    while (
      await fs
        .access(destPath)
        .then(() => false)
        .catch(() => true)
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    // Replace CREATE TABLE statements to ensure compatibility
    let content = await fs.readFile(destPath, 'utf-8');
    content = content.replace('CREATE TABLE logs', 'CREATE TABLE IF NOT EXISTS logs');
    await fs.writeFile(destPath, content, 'utf-8');
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
const db = new SQLiteLogDatabase(process.env.DATABASE_FILENAME || 'default');

/**
 * Create a new LogDatabase instance at a custom path.
 * @param {string} dbPath - Custom database filename without extension.
 * @returns {SQLiteLogDatabase} LogDatabase instance.
 */
export function createLogDatabase(dbPath) {
  return new SQLiteLogDatabase(dbPath);
}

/**
 * Backup the singleton log database to a specified destination.
 * @param {string} destPath - The destination file path for the backup.
 * @returns {Promise<void>} Resolves when backup is complete.
 */
export function backupLogDatabase(destPath) {
  return db.backup(destPath);
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
