import { LogDatabase } from '../../src/database/LogDatabase.js';
import fs from 'fs-extra';
import path from 'upath';
import { jest } from '@jest/globals';
import { SQLiteLogDatabase } from '../../src/database/SQLiteLogDatabase.js';

// Increase Jest timeout for slow DB operations
jest.setTimeout(60000);

describe('LogDatabase (SQLite)', () => {
  const dbName = 'jest_test_logs.db';
  let db: LogDatabase;

  beforeAll(async () => {
    db = new LogDatabase(dbName, { type: 'sqlite' });
    await db.addLog({ id: '1', data: { foo: 'bar' }, message: 'SQLite test log' }, { timeout: 60000 });
  }, 60000);

  afterAll(async () => {
    await db.close();
    const dbPath = path.join(process.cwd(), dbName);
    if (fs.existsSync(dbPath)) fs.removeSync(dbPath);
  }, 60000);

  it('should database type SQLite', async () => {
    // Validate db.store is instance of SQLiteLogDatabase
    expect(db['store']).toBeInstanceOf(SQLiteLogDatabase);
    // Validate getType()
    const type = await db.getType();
    expect(type.optionsType).toBe('sqlite');
    expect(type.classType).toBe('sqlite');
  });

  it('should add and retrieve a log', async () => {
    const log = await db.getLogById('1');
    expect(log).toBeDefined();
    expect(log?.data).toEqual({ foo: 'bar' });
    expect(log?.message).toBe('SQLite test log');
  });
});
