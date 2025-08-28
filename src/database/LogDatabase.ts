import { getChecksum, SharedPreferences } from 'sbg-utility';
import fs from 'fs-extra';
import path from 'upath';
import createDatabasePool from './mysql.js';
import { MysqlLogDatabase } from './MysqlLogDatabase.js';
import { getDatabaseFilePath, SQLiteLogDatabase } from './SQLiteLogDatabase.js';
import { BaseLogDatabase, LogEntry } from './BaseLogDatabase.js';

type MySQL2Options = Partial<Parameters<typeof createDatabasePool>[0]>;
export interface LogDatabaseOptions extends MySQL2Options {
  [key: string]: any;
  type?: 'sqlite' | 'mysql';
}

export class LogDatabase implements BaseLogDatabase {
  options: LogDatabaseOptions;
  dbName: string;
  store: MysqlLogDatabase | SQLiteLogDatabase;
  pref: SharedPreferences;

  constructor(dbName?: string, options?: LogDatabaseOptions) {
    this.options = options;
    this.dbName = dbName || 'default';
    this.pref = new SharedPreferences({ namespace: this.constructor.name });
  }

  async addLog<T = any>(log: LogEntry<T>, options?: { timeout?: number }) {
    if (!this.store) await this.initialize();
    return await this.store.addLog(log, options);
  }

  async removeLog(id: LogEntry<any>['id']) {
    if (!this.store) await this.initialize();
    return await this.store.removeLog(id);
  }

  async getLogById<T = any>(id: LogEntry<any>['id']): Promise<LogEntry<T> | undefined> {
    if (!this.store) await this.initialize();
    return await this.store.getLogById(id);
  }

  async getLogs<T = any>(
    filterFn?: (log: LogEntry<T>) => boolean | Promise<boolean>,
    options?: { limit?: number; offset?: number }
  ) {
    if (!this.store) await this.initialize();
    return await this.store.getLogs(filterFn, options);
  }

  async waitReady() {
    if (!this.store) await this.initialize();
    if (this.store instanceof MysqlLogDatabase) {
      return await this.store.waitReady();
    }
  }

  async query(sql: string, params?: any[]) {
    this.store.query(sql, params);
  }

  async close() {
    if (!this.store) return;
    // Run migration when closing SQLite database
    if (this.store instanceof SQLiteLogDatabase || this.pref.getBoolean('needsMigration', false)) {
      try {
        await this.migrate();
      } catch (e) {
        console.error('Migration error:', e);
        this.pref.putBoolean('needsMigration', true);
      }
    }
    await this.store.close();
  }

  async initialize() {
    if (this.options?.type === 'sqlite') {
      this.store = new SQLiteLogDatabase(this.dbName);
    } else if (this.options?.type === 'mysql') {
      this.store = new MysqlLogDatabase(this.dbName, this.options);
    } else {
      // auto
      try {
        this.store = new MysqlLogDatabase(this.dbName, this.options);
      } catch (error) {
        console.error('Error initializing database:', (error as Error).message);
        console.error('Falling back to SQLite database.');
        this.store = new SQLiteLogDatabase(this.dbName);
      }
    }
  }

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
  private isChecksumChanged(save = false) {
    const sqliteFile = getDatabaseFilePath(this.dbName);
    const sqliteChecksum = getChecksum(sqliteFile);
    const checksumFile = path.join(process.cwd(), `.cache/migrations/${this.dbName || 'logs'}.checksum`);
    const lastChecksum = fs.existsSync(checksumFile) ? fs.readFileSync(checksumFile, 'utf-8') : null;
    if (save && lastChecksum !== sqliteChecksum) {
      fs.ensureDirSync(path.dirname(checksumFile));
      fs.writeFileSync(checksumFile, sqliteChecksum);
    }
    return lastChecksum !== sqliteChecksum;
  }

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
  async migrate() {
    // Only migrate if checksum has changed
    if (!this.isChecksumChanged()) {
      // Skipping migration as it has already been completed
      return;
    }
    // Perform migration
    const sqlite = new SQLiteLogDatabase(this.dbName);
    const mysql = new MysqlLogDatabase(this.dbName);

    const logs = sqlite.getLogs();
    for await (const log of logs) {
      if (await mysql.getLogById(log.id)) {
        console.log(`Skipping existing log id=${log.id}`);
        continue;
      }
      await mysql.addLog(log);
      console.log(`Migrated log id=${log.id}`);
    }

    sqlite.close();
    await mysql.close();
    // Save new checksum after migration
    this.isChecksumChanged(true);
  }
}
