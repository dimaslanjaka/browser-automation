import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import path from 'upath';
import fs from 'fs-extra';
import { LogDatabase } from '../src/logHelper.js';

const TEST_DB_NAME = 'test-log-db';
const BACKUP_DIR = path.join(process.cwd(), 'databases');
const BACKUP_PATH = path.join(BACKUP_DIR, TEST_DB_NAME + '.sql');

// --- Helpers ---
function clearLogs(db) {
  db.getLogs().forEach((log) => db.removeLog(log.id));
}

function expectValidTimestamp(ts) {
  expect(typeof ts).toBe('string');
  // Regex for RFC 3339 with +07:00 offset
  expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+07:00$/);
}

function ensureDirExists(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function cleanupFile(filePath) {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

// --- Tests ---
describe('LogDatabase', () => {
  /** @type {LogDatabase} */
  let logDb;

  beforeEach(() => {
    logDb = new LogDatabase(TEST_DB_NAME);
    clearLogs(logDb);
  });

  afterEach(() => {
    clearLogs(logDb);
    cleanupFile(BACKUP_PATH);
  });

  test('addLog adds a log entry', () => {
    logDb.addLog({ id: '1', data: { foo: 'bar' }, message: 'Test log' });

    const logs = logDb.getLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({
      id: '1',
      data: { foo: 'bar' },
      message: 'Test log'
    });
    expectValidTimestamp(logs[0].timestamp);
  });

  test('removeLog removes a log entry by id', () => {
    logDb.addLog({ id: '2', data: {}, message: 'To be removed' });
    expect(logDb.getLogs()).toHaveLength(1);

    logDb.removeLog('2');
    expect(logDb.getLogs()).toHaveLength(0);
  });

  test('getLogById returns the correct log entry', () => {
    logDb.addLog({ id: '5', data: { foo: 'baz' }, message: 'Find me' });

    const log = logDb.getLogById('5');
    expect(log).toBeDefined();
    expect(log).toMatchObject({
      id: '5',
      data: { foo: 'baz' },
      message: 'Find me'
    });
    expectValidTimestamp(log.timestamp);
  });

  test('getLogs returns filtered logs', () => {
    logDb.addLog({ id: '3', data: { type: 'a' }, message: 'A' });
    logDb.addLog({ id: '4', data: { type: 'b' }, message: 'B' });

    const filtered = logDb.getLogs((log) => log.data.type === 'a');
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe('3');
  });

  test('backup saves database to databases/<dbName>.sql', async () => {
    ensureDirExists(BACKUP_DIR);

    logDb.addLog({ id: 'backup-test', data: { foo: 'backup' }, message: 'Backup log' });
    await logDb.backup(BACKUP_PATH);

    expect(fs.existsSync(BACKUP_PATH)).toBe(true);
    const stats = fs.statSync(BACKUP_PATH);
    expect(stats.size).toBeGreaterThan(0);
    const content = fs.readFileSync(BACKUP_PATH, 'utf-8');
    expect(content).toContain(`CREATE TABLE IF NOT EXISTS logs`);
    expect(content).toContain(` INTO logs`);
    expect(content).toContain(` INTO logs`);
  });
});
