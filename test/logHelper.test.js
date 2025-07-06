import { afterEach, beforeEach, describe, expect, test } from '@jest/globals';
import { addLog, getLogById, getLogs, removeLog } from '../src/logHelper.js';

describe('logHelper', () => {
  beforeEach(() => {
    // Clear logs before each test
    getLogs().forEach((log) => removeLog(log.id));
  });

  afterEach(() => {
    // Remove all logs after each test to ensure clean state
    getLogs().forEach((log) => removeLog(log.id));
  });

  test('addLog adds a log entry', () => {
    addLog({ id: '1', data: { foo: 'bar' }, message: 'Test log' });
    const logs = getLogs();
    expect(logs.length).toBe(1);
    expect(logs[0]).toMatchObject({
      id: '1',
      data: { foo: 'bar' },
      message: 'Test log'
    });
    // Check timestamp format: 2025-07-06T12:34:56+07:00 (RFC 3999, Asia/Jakarta)
    expect(typeof logs[0].timestamp).toBe('string');
    // Regex for RFC 3999 with +07:00 offset
    expect(logs[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\+07:00$/);
  });

  test('removeLog removes a log entry by id', () => {
    addLog({ id: '2', data: {}, message: 'To be removed' });
    expect(getLogs().length).toBe(1);
    removeLog('2');
    expect(getLogs().length).toBe(0);
  });

  test('getLogById returns the correct log entry', () => {
    addLog({ id: '5', data: { foo: 'baz' }, message: 'Find me' });
    const log = getLogById('5');
    expect(log).toBeDefined();
    expect(log).toMatchObject({
      id: '5',
      data: { foo: 'baz' },
      message: 'Find me'
    });
    expect(typeof log.timestamp).toBe('string');
  });

  test('getLogs returns filtered logs', () => {
    addLog({ id: '3', data: { type: 'a' }, message: 'A' });
    addLog({ id: '4', data: { type: 'b' }, message: 'B' });
    const filtered = getLogs((log) => log.data.type === 'a');
    expect(filtered.length).toBe(1);
    expect(filtered[0].id).toBe('3');
  });
});
