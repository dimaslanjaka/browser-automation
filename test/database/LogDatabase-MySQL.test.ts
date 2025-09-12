import { LogDatabase } from '../../src/database/LogDatabase.js';
import { MysqlLogDatabase } from '../../src/database/MysqlLogDatabase.js';
import { jest } from '@jest/globals';

// Increase Jest timeout for slow DB operations
jest.setTimeout(60000);

describe('LogDatabase (MySQL)', () => {
  const dbName = 'jest_test_logs_mysql';
  let db: LogDatabase;

  beforeAll(async () => {
    db = new LogDatabase(dbName, { connectTimeout: 60000, type: 'mysql' });
    await db.initialize();
  }, 60000);

  afterAll(async () => {
    // Clean up test database
    await db.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    await db.close();
  }, 60000);

  it('should defined MySQL environment', () => {
    expect(process.env.MYSQL_USER).not.toBeNull();
    expect(process.env.MYSQL_USER).not.toBeUndefined();
    expect(process.env.MYSQL_USER).not.toBe('');
    expect(process.env.MYSQL_PASS).not.toBeNull();
    expect(process.env.MYSQL_PASS).not.toBeUndefined();
    expect(process.env.MYSQL_PASS).not.toBe('');
    expect(process.env.MYSQL_HOST).not.toBeNull();
    expect(process.env.MYSQL_HOST).not.toBeUndefined();
    expect(process.env.MYSQL_HOST).not.toBe('');
    expect(process.env.MYSQL_DBNAME).not.toBeNull();
    expect(process.env.MYSQL_DBNAME).not.toBeUndefined();
    expect(process.env.MYSQL_DBNAME).not.toBe('');
  });

  it('should database type MySQL', async () => {
    // Validate db.store is instance of MysqlLogDatabase
    expect(db['store']).toBeInstanceOf(MysqlLogDatabase);
    // Validate getType()
    const type = await db.getType();
    expect(type.optionsType).toBe('mysql');
    expect(type.classType).toBe('mysql');
  });

  it('should add and retrieve a log', async () => {
    await db.addLog({ id: '2', data: { foo: 'baz' }, message: 'MySQL test log' }, { timeout: 60000 });
    const log = await db.getLogById('2');
    expect(log).toBeDefined();
    expect(log?.data).toEqual({ foo: 'baz' });
    expect(log?.message).toBe('MySQL test log');
  });

  it('should report closed state correctly', async () => {
    expect(db.isClosed()).toBe(false);
    await db.close();
    expect(db.isClosed()).toBe(true);
    // Reopen for other tests
    db = new LogDatabase(dbName, { connectTimeout: 60000, type: 'mysql' });
    await db.initialize();
  });
});
