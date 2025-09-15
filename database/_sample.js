import 'dotenv/config';
import { MySQLHelper } from './MySQLHelper.js';

const { MYSQL_HOST, MYSQL_USER, MYSQL_PASS, MYSQL_DBNAME, MYSQL_PORT } = process.env;
async function main() {
  const pool = new MySQLHelper({
    host: MYSQL_HOST,
    user: MYSQL_USER,
    password: MYSQL_PASS,
    database: MYSQL_DBNAME,
    port: MYSQL_PORT ? parseInt(MYSQL_PORT, 10) : void 0
  });
  try {
    await pool.initialize();
    const rows = await pool.query("SELECT NOW() AS now");
    console.log("Current DB time:", rows[0].now);
    const maxAllowedPacket = await pool.query("SHOW VARIABLES LIKE 'max_allowed_packet'");
    const netReadTimeout = await pool.query("SHOW VARIABLES LIKE 'net_read_timeout'");
    const netWriteTimeout = await pool.query("SHOW VARIABLES LIKE 'net_write_timeout'");
    console.log("max_allowed_packet:", maxAllowedPacket[0]);
    console.log("net_read_timeout:", netReadTimeout[0]);
    console.log("net_write_timeout:", netWriteTimeout[0]);
    const processList = await pool.query("SHOW PROCESSLIST");
    console.log("Process List count:", processList.length);
    const maxConnections = await pool.query("SHOW VARIABLES LIKE 'max_connections'");
    const threadsConnected = await pool.query("SHOW STATUS LIKE 'Threads_connected'");
    const threadsRunning = await pool.query("SHOW STATUS LIKE 'Threads_running'");
    console.log("max_connections:", maxConnections[0]);
    console.log("Threads_connected:", threadsConnected[0]);
    console.log("Threads_running:", threadsRunning[0]);
  } catch (err) {
    console.error("Database error:", err);
  } finally {
    await pool.close();
  }
}
main();
//# sourceMappingURL=_sample.js.map
//# sourceMappingURL=_sample.js.map