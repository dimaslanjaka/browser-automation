const browserUtility = require('../dist/index.cjs');

// jest.mock('sbg-utility', () => ({}));
// jest.mock('puppeteer-extra', () => ({}));

describe('browserUtility exports', () => {
  const methods = ['getActivePage', 'connectEndpoint'];

  test.each(methods)('%s should be a function', (method) => {
    expect(browserUtility).toHaveProperty(method);
    expect(typeof browserUtility[method]).toBe('function');
  });
});
