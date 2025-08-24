import mysql from 'mysql2/promise';
import 'dotenv/config';

const { MYSQL_HOST, MYSQL_USER, MYSQL_PASS, MYSQL_DBNAME, MYSQL_PORT } = process.env;

/**
 * Create a MySQL connection pool, ensuring the database exists.
 *
 * @param config Optional additional pool configuration.
 * @returns A promise that resolves to a MySQL connection pool.
 * @throws If required environment variables are missing.
 */
async function createDatabasePool(config: mysql.PoolOptions = {}) {
  if (!MYSQL_HOST || !MYSQL_USER || !MYSQL_PASS) {
    throw new Error('Missing one of the required environment variables: MYSQL_HOST, MYSQL_USER, MYSQL_PASS');
  }
  // Determine which database to use
  const dbName = config.database || MYSQL_DBNAME;
  if (!dbName) {
    throw new Error('No database name provided in config or MYSQL_DBNAME');
  }
  // Connect without specifying a DB
  const connection = await mysql.createConnection({
    host: MYSQL_HOST,
    user: MYSQL_USER,
    password: MYSQL_PASS,
    port: parseInt(MYSQL_PORT ?? '3306', 10)
  });

  // Create database if it doesn't exist
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  await connection.end();

  // Now create a pool that connects to that DB
  return mysql.createPool({
    host: MYSQL_HOST,
    user: MYSQL_USER,
    password: MYSQL_PASS,
    database: dbName,
    port: parseInt(MYSQL_PORT ?? '3306', 10),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ...config
  });
}

export default createDatabasePool;
