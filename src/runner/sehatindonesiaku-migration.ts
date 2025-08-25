// Migration script from SQLite to MySQL

import fs from 'fs-extra';
import path from 'path';
import { MysqlLogDatabase } from '../database/MysqlLogDatabase.js';
import { SQLiteLogDatabase } from '../database/SQLiteLogDatabase.js';

/**
 * Migrates logs from the SQLite database to the MySQL database for 'sehatindonesiaku-kemkes'.
 * Skips logs that already exist in the MySQL database.
 * Closes both database connections after migration.
 */
export async function migrate(): Promise<void> {
  const sqlite = new SQLiteLogDatabase('sehatindonesiaku-kemkes');
  const mysql = new MysqlLogDatabase('sehatindonesiaku-kemkes');

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
}

/**
 * Runs the migration only if it hasn't already been completed for the given id.
 * Uses a lock file in `.cache/migrations/` to prevent duplicate migrations.
 * @param id - Unique identifier for the migration lock file.
 */
export default async function migrateIfNeeded(id: string): Promise<void> {
  const filePath = path.join(process.cwd(), `.cache/migrations/${id}.lock`);
  if (fs.existsSync(filePath)) {
    // console.log(`Migration already completed for id=${id}`);
    return;
  }
  fs.ensureDirSync(path.dirname(filePath));
  fs.writeFileSync(filePath, 'lock');
  await migrate();
}
