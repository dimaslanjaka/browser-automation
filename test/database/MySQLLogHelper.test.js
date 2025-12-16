import { afterEach, beforeEach, describe, expect, test, jest } from '@jest/globals';
import path from 'upath';
import fs from 'fs-extra';
import { MySQLLogDatabase } from '../../src/database/MySQLLogDatabase.js';

const TEST_TABLE = process.env.MYSQL_TABLE || 'test_log_table';
const TEST_DB_NAME = process.env.MYSQL_DBNAME || process.env.MYSQL_DATABASE || 'test_mysql_db';
const BACKUP_DIR = path.join(process.cwd(), 'databases');
const BACKUP_PATH = path.join(BACKUP_DIR, `${TEST_TABLE}.sql`);

// Only run tests when basic MySQL credentials are available
const hasMySQL = Boolean(process.env.MYSQL_USER && (process.env.MYSQL_PASS || process.env.MYSQL_PASSWORD));
if (hasMySQL) jest.setTimeout(300000);

function expectValidTimestamp(ts) {
  expect(typeof ts).toBe('string');
  expect(ts).toMatch(/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}([+-][0-9]{2}:[0-9]{2}|Z)$/);
}

function cleanupFile(filePath) {
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

if (!hasMySQL) {
  describe.skip('MySQLLogDatabase (skipped: no MySQL credentials)', () => {
    test('skipped', () => {
      expect(true).toBe(true);
    });
  });
} else {
  describe('MySQLLogDatabase', () => {
    /** @type {MySQLLogDatabase} */
    let logDb;

    beforeEach(async () => {
      logDb = new MySQLLogDatabase(TEST_TABLE, TEST_DB_NAME);
      // ensure initialization finished
      if (typeof logDb.initialize === 'function') await logDb.initialize();
      // clear existing logs
      const existing = await logDb.getLogs();
      // remove sequentially
      for (const l of existing) await logDb.removeLog(l.id);
    });

    afterEach(async () => {
      const existing = await logDb.getLogs();
      for (const l of existing) await logDb.removeLog(l.id);
      cleanupFile(BACKUP_PATH);
      await logDb.close();
    });

    test('addLog adds a log entry', async () => {
      await logDb.addLog({ id: '1', data: { foo: 'bar' }, message: 'Test log' });

      const logs = await logDb.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0]).toMatchObject({ id: '1', data: { foo: 'bar' }, message: 'Test log' });
      expectValidTimestamp(logs[0].timestamp);
    });

    test('removeLog removes a log entry by id', async () => {
      await logDb.addLog({ id: '2', data: {}, message: 'To be removed' });
      const before = await logDb.getLogs();
      expect(before.length).toBeGreaterThanOrEqual(1);

      const removed = await logDb.removeLog('2');
      expect(removed).toBe(true);
      const after = await logDb.getLogs();
      expect(after.find((r) => r.id === '2')).toBeUndefined();
    });

    test('getLogById returns the correct log entry', async () => {
      await logDb.addLog({ id: '5', data: { foo: 'baz' }, message: 'Find me' });

      const log = await logDb.getLogById('5');
      expect(log).toBeDefined();
      expect(log).toMatchObject({ id: '5', data: { foo: 'baz' }, message: 'Find me' });
      expectValidTimestamp(log.timestamp);
    });

    test('getLogs returns filtered logs', async () => {
      await logDb.addLog({ id: '3', data: { type: 'a' }, message: 'A' });
      await logDb.addLog({ id: '4', data: { type: 'b' }, message: 'B' });

      const filtered = await logDb.getLogs((log) => log.data.type === 'a');
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('3');
    });

    test('backup saves table to databases/<table>.sql', async () => {
      if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

      await logDb.addLog({ id: 'backup-test', data: { foo: 'backup' }, message: 'Backup log' });
      await logDb.backup(BACKUP_PATH);

      expect(fs.existsSync(BACKUP_PATH)).toBe(true);
      const stats = fs.statSync(BACKUP_PATH);
      expect(stats.size).toBeGreaterThan(0);
      const content = fs.readFileSync(BACKUP_PATH, 'utf-8');
      expect(content).toContain(`CREATE TABLE`);
      expect(content).toContain(`INSERT INTO`);
    });
  });
}
