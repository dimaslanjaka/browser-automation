import 'dotenv/config';
import { MysqlLogDatabase } from '../../src/database/MysqlLogDatabase.js';

const { MYSQL_HOST, MYSQL_USER, MYSQL_PASS, MYSQL_PORT } = process.env;

describe('MysqlLogDatabase', () => {
  let db: MysqlLogDatabase;
  const dbName = 'browser_automation_test';

  beforeAll(async () => {
    db = new MysqlLogDatabase(dbName, {
      user: MYSQL_USER,
      password: MYSQL_PASS,
      host: MYSQL_HOST,
      port: MYSQL_PORT ? parseInt(MYSQL_PORT, 10) : undefined
    });
    await db.waitReady();
  }, 60000);

  afterAll(async () => {
    await db.removeLog('log1');
    await db.removeLog('log2');
    await db.removeLog('log3');
    await db.close();
  }, 60000);

  it('should add and retrieve a log entry', async () => {
    const log = { id: 'log1', data: { foo: 'bar' }, message: 'Test log' };
    await db.addLog(log);
    const result = await db.getLogById('log1');
    expect(result).toBeDefined();
    expect(result?.id).toBe('log1');
    expect(result?.data).toEqual({ foo: 'bar' });
    expect(result?.message).toBe('Test log');
    expect(typeof result?.timestamp).toBe('string');
  }, 60000);

  it('should update a log entry', async () => {
    const log = { id: 'log1', data: { foo: 'baz' }, message: 'Updated log' };
    await db.addLog(log);
    const result = await db.getLogById('log1');
    expect(result?.data).toEqual({ foo: 'baz' });
    expect(result?.message).toBe('Updated log');
  }, 60000);

  it('should remove a log entry', async () => {
    const removed = await db.removeLog('log1');
    expect(removed).toBe(true);
    const result = await db.getLogById('log1');
    expect(result).toBeUndefined();
  }, 60000);

  it('should return all logs', async () => {
    await db.addLog({ id: 'log2', data: { a: 1 }, message: 'A' });
    await db.addLog({ id: 'log3', data: { b: 2 }, message: 'B' });
    const logs = await db.getLogs();
    const ids = logs.map((l) => l.id.toString());
    expect(ids).toEqual(expect.arrayContaining(['log2', 'log3']));
    logs.forEach((log) => {
      expect(typeof log.timestamp).toBe('string');
    });
  }, 60000);

  it('should filter logs with filterFn', async () => {
    const logs = await db.getLogs((log) => log.id === 'log2');
    expect(logs.length).toBe(1);
    expect(logs[0].id).toBe('log2');
  }, 60000);

  // it('should report closed state correctly', async () => {
  //   expect(db.isClosed()).toBe(false);
  //   await db.close();
  //   expect(db.isClosed()).toBe(true);
  // }, 60000);
});
