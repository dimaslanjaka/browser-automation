import mariadb from 'mariadb';
import 'dotenv/config';

const { MYSQL_HOST, MYSQL_USER, MYSQL_PASS, MYSQL_DBNAME, MYSQL_PORT } = process.env;

// Singleton pool cache: key is a stringified config/database name
const poolCache = new Map<string, Promise<mariadb.Pool>>();

/**
 * Create a MySQL connection pool, ensuring the database exists.
 * Uses a singleton pattern: only one pool per unique config/database.
 *
 * @param config Optional additional pool configuration.
 * @returns A promise that resolves to a MySQL connection pool.
 * @throws If required environment variables are missing.
 */
async function createDatabasePool(config: mariadb.PoolConfig = {}) {
  if (!MYSQL_HOST || !MYSQL_USER || !MYSQL_PASS) {
    throw new Error('Missing one of the required environment variables: MYSQL_HOST, MYSQL_USER, MYSQL_PASS');
  }
  // Determine which database to use
  const dbName = config.database || MYSQL_DBNAME;
  if (!dbName) {
    throw new Error('No database name provided in config or MYSQL_DBNAME');
  }
  // Use config and dbName as a key for the pool cache
  const key = JSON.stringify({ ...config, database: dbName });
  if (poolCache.has(key)) {
    return poolCache.get(key)!;
  }
  // Create the pool and cache the promise immediately to avoid race conditions
  const poolPromise = (async () => {
    // Connect without specifying a DB to create the database if needed
    const adminConn = await mariadb.createConnection({
      host: MYSQL_HOST,
      user: MYSQL_USER,
      password: MYSQL_PASS,
      port: parseInt(MYSQL_PORT ?? '3306', 10),
      connectTimeout: config.connectTimeout || 60000,
      allowPublicKeyRetrieval: true
    });
    await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    await adminConn.end();

    // Now create a pool that connects to that DB
    return mariadb.createPool({
      host: MYSQL_HOST,
      user: MYSQL_USER,
      password: MYSQL_PASS,
      database: dbName,
      port: parseInt(MYSQL_PORT ?? '3306', 10),
      connectionLimit: config.connectionLimit || 1,
      connectTimeout: config.connectTimeout || 60000,
      allowPublicKeyRetrieval: true,
      ...config
    });
  })();
  poolCache.set(key, poolPromise);
  return poolPromise;
}

export default createDatabasePool;
