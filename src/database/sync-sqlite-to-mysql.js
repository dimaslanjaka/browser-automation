import { SQLiteLogDatabase } from './SQLiteLogDatabase.js';
import { MySQLLogDatabase } from './MySQLLogDatabase.js';
import _fs from 'fs-extra';

/**
 * Sync logs from a SQLite database to a MySQL table.
 * Options:
 *  - sqliteName: SQLite database filename (without .db)
 *  - mysqlTable: MySQL table name to write into
 *  - mysqlDbName: MySQL database name
 *  - dryRun: if true, don't write to MySQL
 *  - concurrency: number of concurrent inserts
 *  - remove: if true, remove rows from SQLite after successful insert
 */
export async function syncSqliteToMySQL({
  sqliteName = process.env.DATABASE_FILENAME || 'default',
  mysqlTable = process.env.MYSQL_TABLE || 'logs',
  mysqlDbName = process.env.MYSQL_DBNAME || process.env.MYSQL_DATABASE,
  dryRun = false,
  concurrency = 10,
  remove = false
} = {}) {
  const sqliteDb = new SQLiteLogDatabase(sqliteName);
  const mysqlDb = new MySQLLogDatabase(mysqlTable, mysqlDbName);

  try {
    const logs = sqliteDb.getLogs();
    if (!logs || logs.length === 0) {
      console.log('No logs found to migrate.');
      return { migrated: 0 };
    }

    console.log(`Found ${logs.length} logs. Starting migration (dryRun=${dryRun}).`);

    let migrated = 0;

    // process in batches with concurrency
    for (let i = 0; i < logs.length; i += concurrency) {
      const batch = logs.slice(i, i + concurrency);
      const promises = batch.map(async (log) => {
        if (dryRun) return true;
        try {
          await mysqlDb.addLog(log);
          migrated += 1;
          if (remove) sqliteDb.removeLog(log.id);
          return true;
        } catch (err) {
          console.error('Failed to migrate log', log.id, err);
          return false;
        }
      });

      await Promise.all(promises);
    }

    console.log(`Migration complete. migrated=${migrated}`);
    return { migrated };
  } finally {
    try {
      sqliteDb.close();
    } catch (_e) {
      // ignore
    }
    try {
      await mysqlDb.close();
    } catch (_e) {
      // ignore
    }
  }
}

// CLI usability
if (process.argv[1] && process.argv[1].endsWith('sync-sqlite-to-mysql.js')) {
  (async () => {
    const [, , sqliteNameArg, mysqlTableArg, mysqlDbArg, ...rest] = process.argv;
    const opts = {
      sqliteName: sqliteNameArg || undefined,
      mysqlTable: mysqlTableArg || undefined,
      mysqlDbName: mysqlDbArg || undefined,
      dryRun: rest.includes('--dry-run'),
      remove: rest.includes('--remove'),
      concurrency: parseInt((rest.find((s) => s.startsWith('--concurrency=')) || '').split('=')[1], 10) || 10
    };
    try {
      await syncSqliteToMySQL(opts);
      process.exit(0);
    } catch (err) {
      console.error('Migration failed:', err);
      process.exit(2);
    }
  })();
}
