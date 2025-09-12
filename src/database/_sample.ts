import createDatabasePool from './mysql.js';

async function main() {
  const pool = await createDatabasePool();
  try {
    // Run a SELECT query
    const [rows] = await pool.query('SELECT NOW() AS now');
    console.log('Current DB time:', rows);

    // Show MySQL variables
    const [maxAllowedPacket] = await pool.query("SHOW VARIABLES LIKE 'max_allowed_packet'");
    const [netReadTimeout] = await pool.query("SHOW VARIABLES LIKE 'net_read_timeout'");
    const [netWriteTimeout] = await pool.query("SHOW VARIABLES LIKE 'net_write_timeout'");
    console.log('max_allowed_packet:', maxAllowedPacket);
    console.log('net_read_timeout:', netReadTimeout);
    console.log('net_write_timeout:', netWriteTimeout);

    // Show process list
    const [processList] = await pool.query('SHOW PROCESSLIST');
    console.log('Process List:', processList);

    // Show additional MySQL variables and status
    const [maxConnections] = await pool.query("SHOW VARIABLES LIKE 'max_connections'");
    const [threadsConnected] = await pool.query("SHOW STATUS LIKE 'Threads_connected'");
    const [threadsRunning] = await pool.query("SHOW STATUS LIKE 'Threads_running'");
    console.log('max_connections:', maxConnections);
    console.log('Threads_connected:', threadsConnected);
    console.log('Threads_running:', threadsRunning);
  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await pool.end(); // Close the pool when your app exits
  }
}

main();
