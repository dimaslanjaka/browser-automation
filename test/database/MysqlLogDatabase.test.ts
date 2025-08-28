import { MysqlLogDatabase } from '../../src/database/MysqlLogDatabase.js';
import 'dotenv/config.js';

describe('MysqlLogDatabase', () => {
  let db: MysqlLogDatabase;
  const dbName = 'test_logs';

  beforeAll(async () => {
    db = new MysqlLogDatabase(dbName);
    await db.waitReady();
  });

  afterAll(async () => {
    // Clean up test database
    const pool = await db.waitReady().then(() => db['poolPromise']);
    await pool.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    await db.close();
  });

  it('should add and retrieve a log entry', async () => {
    const log = { id: 'log1', data: { foo: 'bar' }, message: 'Test log' };
    await db.addLog(log);
    const result = await db.getLogById('log1');
    expect(result).toBeDefined();
    expect(result?.id).toBe('log1');
    expect(result?.data).toEqual({ foo: 'bar' });
    expect(result?.message).toBe('Test log');
    expect(typeof result?.timestamp).toBe('string');
  });

  it('should update a log entry', async () => {
    const log = { id: 'log1', data: { foo: 'baz' }, message: 'Updated log' };
    await db.addLog(log);
    const result = await db.getLogById('log1');
    expect(result?.data).toEqual({ foo: 'baz' });
    expect(result?.message).toBe('Updated log');
  });

  it('should remove a log entry', async () => {
    const removed = await db.removeLog('log1');
    expect(removed).toBe(true);
    const result = await db.getLogById('log1');
    expect(result).toBeUndefined();
  });

  it('should return all logs', async () => {
    await db.addLog({ id: 'log2', data: { a: 1 }, message: 'A' });
    await db.addLog({ id: 'log3', data: { b: 2 }, message: 'B' });
    const logs = await db.getLogs();
    const ids = logs.map((l) => l.id.toString());
    expect(ids).toEqual(expect.arrayContaining(['log2', 'log3']));
    logs.forEach((log) => {
      expect(typeof log.timestamp).toBe('string');
    });
  });

  it('should filter logs with filterFn', async () => {
    const logs = await db.getLogs((log) => log.id === 'log2');
    expect(logs.length).toBe(1);
    expect(logs[0].id).toBe('log2');
  });
});
