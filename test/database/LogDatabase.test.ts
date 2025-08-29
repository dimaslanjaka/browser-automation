import { describe, jest } from '@jest/globals';
import { LogDatabase } from '../../src/database/LogDatabase.js';

// Increase Jest timeout for slow DB operations
jest.setTimeout(60000);

describe('LogDatabase', () => {
  let db: LogDatabase;
  const dbName = 'jest';

  beforeAll(async () => {
    db = new LogDatabase(dbName);
    await db.initialize();
  }, 60000);

  afterAll(async () => {
    // Clean up test database
    await db.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    await db.close();
  }, 60000);

  it('should add, retrieve, delete a log', async () => {
    await db.addLog({ id: '1', data: { foo: 'bar' }, message: 'Test log' });
    const log = await db.getLogById('1');
    expect(log).toBeDefined();
    expect(log?.data).toEqual({ foo: 'bar' });
    expect(log?.message).toBe('Test log');
    // Delete log
    await db.removeLog('1');
    const deletedLog = await db.getLogById('1');
    expect(!deletedLog).toBe(true);
  });

  it('should not empty logs', async () => {
    await db.addLog({ id: '1', data: { foo: 'bar' }, message: 'Test log' });
    const logs = await db.getLogs();
    expect(logs.length).toBeGreaterThan(0);
    // Delete log
    await db.removeLog('1');
    const deletedLog = await db.getLogById('1');
    expect(!deletedLog).toBe(true);
  });
});
