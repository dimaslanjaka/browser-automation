import { getChecksum } from 'sbg-utility';
import fs from 'fs-extra';
import path from 'upath';
import createDatabasePool from './mysql.js';
import { MysqlLogDatabase } from './MysqlLogDatabase.js';
import { getDatabaseFilePath, SQLiteLogDatabase } from './SQLiteLogDatabase.js';
import { BaseLogDatabase, LogEntry } from './BaseLogDatabase.js';

type MySQL2Options = Partial<Parameters<typeof createDatabasePool>[0]>;
export interface LogDatabaseOptions extends MySQL2Options {
  [key: string]: any;
}

export class LogDatabase implements BaseLogDatabase {
  options: LogDatabaseOptions;
  dbName: string;
  store: MysqlLogDatabase | SQLiteLogDatabase;
  constructor(dbName?: string, options?: LogDatabaseOptions) {
    this.options = options;
    this.dbName = dbName;
  }

  async addLog<T = any>(log: LogEntry<T>, options?: { timeout?: number }) {
    return await this.store.addLog(log, options);
  }

  async removeLog(id: LogEntry<any>['id']) {
    return await this.store.removeLog(id);
  }

  async getLogById<T = any>(id: LogEntry<any>['id']): Promise<LogEntry<T> | undefined> {
    return await this.store.getLogById(id);
  }

  async getLogs<T = any>(
    filterFn?: (log: LogEntry<T>) => boolean | Promise<boolean>,
    options?: { limit?: number; offset?: number }
  ) {
    return await this.store.getLogs(filterFn, options);
  }

  waitReady() {
    if (this.store instanceof MysqlLogDatabase) {
      return this.store.waitReady();
    }
  }

  async close() {
    if (this.store instanceof SQLiteLogDatabase) {
      await this.migrate().catch((e) => console.error('Migration error:', e));
    }
    await this.store.close();
  }

  async initialize() {
    try {
      this.store = new MysqlLogDatabase(this.dbName, this.options);
    } catch (error) {
      console.error('Error initializing database:', (error as Error).message);
      console.error('Falling back to SQLite database.');
      this.store = new SQLiteLogDatabase(this.dbName || 'logs.db');
    }
  }

  /**
   * Migrates logs from the SQLite database to the MySQL database for the current dbName.
   *
   * Skips logs that already exist in the MySQL database.
   * Uses a lock file in `.cache/migrations/` (named by the checksum of the SQLite file) to prevent duplicate migrations.
   * If the lock file exists, migration is skipped.
   *
   * @returns Promise that resolves when migration is complete or skipped.
   */
  async migrate() {
    // get checksum of the SQLite database file
    const sqliteFile = getDatabaseFilePath(this.dbName || 'logs.db');
    const sqliteChecksum = getChecksum(sqliteFile);
    const lockPath = path.join(process.cwd(), `.cache/migrations/${sqliteChecksum}.lock`);
    if (fs.existsSync(lockPath)) {
      // Skipping migration as it has already been completed
      return;
    }
    // Perform migration
    const sqlite = new SQLiteLogDatabase(this.dbName || 'logs.db');
    const mysql = new MysqlLogDatabase(this.dbName || 'logs.db');

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
    // Save lock file
    fs.ensureDirSync(path.dirname(lockPath));
    fs.writeFileSync(lockPath, 'lock');
  }
}
