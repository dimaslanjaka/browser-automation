import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import nodeResolve from '@rollup/plugin-node-resolve';
import pkg from './package.json' with { type: 'json' };
import { chunkFileNamesWithExt, entryFileNamesWithExt } from './rollup-utils.js';

const entries = {
  index: 'tmp/dist/src/index.js',

  'database/index': 'tmp/dist/src/database/index.js',

  'puppeteer/parallel/EndpointManager': 'tmp/dist/src/puppeteer/parallel/EndpointManager.js',

  'puppeteer/parallel/EndpointManager.connector': 'tmp/dist/src/puppeteer/parallel/EndpointManager.connector.js',

  'puppeteer/parallel/check.runner': 'tmp/dist/src/puppeteer/parallel/check.runner.js',

  'puppeteer/parallel/launcher.runner': 'tmp/dist/src/puppeteer/parallel/launcher.runner.js',

  'puppeteer/parallel/skrin.runner': 'tmp/dist/src/puppeteer/parallel/skrin.runner.js',

  'puppeteer/parallel/skrin-check-data.runner': 'tmp/dist/src/puppeteer/parallel/skrin-check-data.runner.js',

  'puppeteer/parallel/EndpointManager.runner': 'tmp/dist/src/puppeteer/parallel/EndpointManager.runner.js',

  'puppeteer/parallel/parallel-test.runner': 'tmp/dist/src/puppeteer/parallel/parallel-test.runner.js',

  'puppeteer/parallel/detached.runner': 'tmp/dist/src/puppeteer/parallel/detached.runner.js'
};

const external = [
  /^node:/,

  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),

  'fs',
  'path',
  'os',
  'util',
  'readline',
  'child_process'
];

const extensions = ['.js', '.cjs', '.mjs', '.json', '.node'];
const plugins = [
  nodeResolve({
    extensions,
    preferBuiltins: true
  }),
  json(),
  commonjs({ extensions })
];

export default [
  {
    input: entries,
    external,
    plugins,

    output: {
      dir: 'dist',
      format: 'esm',
      preserveModules: true,
      preserveModulesRoot: 'tmp/dist',
      entryFileNames: entryFileNamesWithExt('mjs'),
      chunkFileNames: chunkFileNamesWithExt('mjs')
    }
  },

  {
    input: entries,
    external,
    plugins,

    output: {
      dir: 'dist',
      format: 'cjs',
      exports: 'auto',
      preserveModules: true,
      preserveModulesRoot: 'tmp/dist',
      entryFileNames: entryFileNamesWithExt('cjs'),
      chunkFileNames: chunkFileNamesWithExt('cjs')
    }
  }
];
