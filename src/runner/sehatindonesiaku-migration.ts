// Migration script from SQLite to MySQL

import fs from 'fs-extra';
import path from 'path';
import { MysqlLogDatabase } from '../database/MysqlLogDatabase.js';
import { getDatabaseFilePath, SQLiteLogDatabase } from '../database/SQLiteLogDatabase.js';
import { getChecksum } from 'sbg-utility';

/**
 * Migrates logs from the SQLite database to the MySQL database for 'sehatindonesiaku-kemkes'.
 * Skips logs that already exist in the MySQL database.
 * Closes both database connections after migration.
 */
export async function migrate() {
  const sqlite = new SQLiteLogDatabase('sehatindonesiaku-kemkes');
  const mysql = new MysqlLogDatabase('sehatindonesiaku-kemkes');

  const logs = sqlite.getLogs();
  for await (const log of logs) {
    const get = await mysql.getLogById(log.id);
    if (typeof get === 'object' && Object.keys(get).length > 0) {
      console.log(`Skipping existing log id=${log.id}`);
      continue;
    }
    await mysql.addLog(log);
    console.log(`Migrated log id=${log.id}`);
  }

  sqlite.close();
  await mysql.close();
}

/**
 * Runs the migration only if it hasn't already been completed for the current SQLite database file.
 *
 * Uses a lock file in `.cache/migrations/` (named by the checksum of the SQLite file) to prevent duplicate migrations.
 * If the lock file exists, migration is skipped.
 *
 * @returns Promise that resolves when migration is complete or skipped.
 */
export default async function migrateIfNeeded() {
  const sqliteFile = getDatabaseFilePath('sehatindonesiaku-kemkes');
  const sqliteChecksum = getChecksum(sqliteFile);
  const filePath = path.join(process.cwd(), `.cache/migrations/${sqliteChecksum}.lock`);
  if (fs.existsSync(filePath)) {
    // console.log(`Migration already completed for id=${id}`);
    return;
  }
  fs.ensureDirSync(path.dirname(filePath));
  fs.writeFileSync(filePath, 'lock');
  await migrate();
}
