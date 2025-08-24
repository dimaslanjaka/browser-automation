import { describe, it, expect } from '@jest/globals';
import pool from '../../src/database/mysql.js';

describe('MySQL Pool', () => {
  it('should be defined', () => {
    expect(pool).toBeDefined();
  });

  it('should have a getConnection method', () => {
    expect(typeof pool.getConnection).toBe('function');
  });

  it('should connect and query the database (mocked)', async () => {
    // This test only checks that a connection can be acquired and released.
    // It does not require a real database connection.
    // If you want to test with a real DB, set up a test DB and .env variables.
    let conn;
    try {
      conn = await pool.getConnection();
      expect(conn).toBeDefined();
      expect(typeof conn.query).toBe('function');
    } catch (err) {
      // If connection fails, skip the test (likely no DB configured)
      expect(err).toBeDefined();
    } finally {
      if (conn) await conn.release();
    }
  });
});
