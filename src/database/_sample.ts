import createDatabasePool from './mysql.js';

async function main() {
  const pool = await createDatabasePool();
  try {
    // Run a SELECT query
    const [rows] = await pool.query('SELECT NOW() AS now');
    console.log('Current DB time:', rows);
  } catch (err) {
    console.error('Database error:', err);
  } finally {
    await pool.end(); // Close the pool when your app exits
  }
}

main();
