import { describe, expect, test } from '@jest/globals';
import browserUtility from '../dist/index.mjs';

describe('browserUtility exports', () => {
  const methods = ['getActivePage', 'connectEndpoint'];

  test.each(methods)('%s should be a function', (method) => {
    expect(browserUtility).toHaveProperty(method);
    expect(typeof browserUtility[method]).toBe('function');
  });
});
