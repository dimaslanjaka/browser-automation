import mysql from 'mysql2/promise';
import 'dotenv/config';

const { MYSQL_HOST, MYSQL_USER, MYSQL_PASS, MYSQL_DBNAME, MYSQL_PORT } = process.env;

async function createDatabasePool() {
  if (!MYSQL_HOST || !MYSQL_USER || !MYSQL_PASS || !MYSQL_DBNAME) {
    throw new Error(
      'Missing one of the required environment variables: MYSQL_HOST, MYSQL_USER, MYSQL_PASS, MYSQL_DBNAME'
    );
  }
  // Connect without specifying a DB
  const connection = await mysql.createConnection({
    host: MYSQL_HOST,
    user: MYSQL_USER,
    password: MYSQL_PASS,
    port: parseInt(MYSQL_PORT ?? '3306', 10)
  });

  // Create database if it doesn't exist
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${MYSQL_DBNAME}\``);
  await connection.end();

  // Now create a pool that connects to that DB
  return mysql.createPool({
    host: MYSQL_HOST,
    user: MYSQL_USER,
    password: MYSQL_PASS,
    database: MYSQL_DBNAME,
    port: parseInt(MYSQL_PORT ?? '3306', 10),
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });
}

export default createDatabasePool;
