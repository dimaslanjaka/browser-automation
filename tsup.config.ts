import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    // Main API entry (require('browser-automation'))
    index: 'src/index.ts',

    // Subpath exports (match package.json "exports" field)
    'database/index': 'src/database/index.ts',
    'puppeteer/parallel/EndpointManager': 'src/puppeteer/parallel/EndpointManager.ts',
    'puppeteer/parallel/EndpointManager.connector': 'src/puppeteer/parallel/EndpointManager.connector.ts',

    // Bin runners (match package.json "bin" field)
    'puppeteer/parallel/check.runner': 'src/puppeteer/parallel/check.runner.ts',
    'puppeteer/parallel/launcher.runner': 'src/puppeteer/parallel/launcher.runner.ts',
    'puppeteer/parallel/skrin.runner': 'src/puppeteer/parallel/skrin.runner.ts',
    'puppeteer/parallel/skrin-check-data.runner': 'src/puppeteer/parallel/skrin-check-data.runner.ts',
    'puppeteer/parallel/EndpointManager.runner': 'src/puppeteer/parallel/EndpointManager.runner.ts',
    'puppeteer/parallel/parallel-test.runner': 'src/puppeteer/parallel/parallel-test.runner.ts',
    'puppeteer/parallel/detached.runner': 'src/puppeteer/parallel/detached.runner.ts'
  },
  outDir: 'dist',
  format: ['esm', 'cjs'],
  splitting: true,
  sourcemap: true,
  clean: true,
  dts: false,
  treeshake: true,
  bundle: true,
  minify: false,
  target: 'node16',
  shims: false
});
