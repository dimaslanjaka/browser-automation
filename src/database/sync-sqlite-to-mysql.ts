import { SQLiteLogDatabase } from './SQLiteLogDatabase.js';
import { MysqlLogDatabase } from './MysqlLogDatabase.js';
import { toValidMySQLDatabaseName } from './db_utils.js';
import minimist from 'minimist';
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
  mysqlDbName = toValidMySQLDatabaseName('skrin_' + (process.env.MYSQL_DBNAME || 'default')),
  dryRun = true,
  concurrency = 10,
  remove = false
} = {}) {
  const { MYSQL_HOST, MYSQL_USER, MYSQL_PASS, MYSQL_PORT } = process.env;
  const sqliteDb = new SQLiteLogDatabase(sqliteName);
  const mysqlDb = new MysqlLogDatabase(mysqlDbName, {
    host: MYSQL_HOST || 'localhost',
    user: MYSQL_USER || 'root',
    password: MYSQL_PASS || '',
    port: Number(MYSQL_PORT) || 3306
  });

  try {
    const logs = sqliteDb.getLogs();
    if (!logs || logs.length === 0) {
      console.log(`No logs found to migrate from SQLite into MySQL database: ${mysqlDbName}.`);
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
if (process.argv[1] && process.argv[1].includes('sync-sqlite-to-mysql')) {
  (async () => {
    await import('dotenv').then((dotenv) => dotenv.config());
    const cliArgs = minimist(process.argv.slice(2), {
      boolean: ['remove', 'force'],
      string: ['concurrency']
    });
    const opts = {
      sqliteName: process.env.DATABASE_FILENAME,
      mysqlDbName: toValidMySQLDatabaseName('skrin_' + (process.env.MYSQL_DBNAME || 'default')),
      dryRun: !cliArgs.force,
      remove: Boolean(cliArgs.remove),
      concurrency: Number.parseInt(String(cliArgs.concurrency || ''), 10) || 10
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
