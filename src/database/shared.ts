import { LogDatabase } from './LogDatabase.js';
import { toValidMySQLDatabaseName } from './db_utils.js';

export function createSkrinDatabase() {
  const { MYSQL_HOST, MYSQL_USER, MYSQL_PASS, MYSQL_PORT } = process.env;
  return new LogDatabase(toValidMySQLDatabaseName('skrin_' + process.env.DATABASE_FILENAME), {
    connectTimeout: 60000,
    connectionLimit: 10,
    host: MYSQL_HOST || 'localhost',
    user: MYSQL_USER || 'root',
    password: MYSQL_PASS || '',
    port: Number(MYSQL_PORT) || 3306,
    type: MYSQL_HOST ? 'mysql' : 'sqlite'
  });
}
