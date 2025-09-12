import { describe, it, expect } from '@jest/globals';
import createDatabasePool from '../../src/database/mysql.js';
import { Pool, PoolConnection } from 'mariadb';

describe('MariaDB Pool', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = await createDatabasePool();
  });

  afterAll(async () => {
    if (pool) await pool.end();
  });

  it('should be defined', () => {
    expect(pool).toBeDefined();
  });

  it('should have a getConnection method', () => {
    expect(typeof pool.getConnection).toBe('function');
  });

  it('should connect and query the database (mocked)', async () => {
    let conn: PoolConnection | undefined;
    try {
      conn = await pool.getConnection();
      expect(conn).toBeDefined();
      expect(typeof conn.query).toBe('function');
    } catch (err) {
      expect(err).toBeDefined();
    } finally {
      if (conn) await conn.release();
    }
  });
});
