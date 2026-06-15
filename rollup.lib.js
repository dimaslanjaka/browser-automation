import commonjs from '@rollup/plugin-commonjs';
import esmShim from '@rollup/plugin-esm-shim';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import fs from 'fs';
import * as glob from 'glob';
import jsonc from 'jsonc-parser';
import path from 'upath';
import { fileURLToPath } from 'url';
import { chunkFileNamesWithExt, entryFileNamesWithExt, externalPackagesFilter } from './rollup-utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tsconfigPath = path.join(__dirname, 'tsconfig.build.json');

/**
 * @type {typeof import('./tsconfig.json')}
 */
const tsconfig = jsonc.parse(fs.readFileSync(path.join(__dirname, 'tsconfig.json'), 'utf-8'));

/**
 * Shared source exclusion patterns.
 * Used by glob input discovery and TypeScript compilation.
 *
 * @type {string[]}
 */
const sourceIgnorePatterns = [
  '**/*.explicit.*',
  '**/*.test.*',
  '**/*.builder.*',
  '**/*.spec.*',
  '*browser*',
  'src/bundle/**/*'
];

/**
 * @type {import('rollup').RollupOptions['input']}
 */
const _partialsInput = glob
  .globSync(['**/index.{js,cjs,mjs}'], {
    posix: true,
    // ignore: tsconfig.exclude.concat(sourceIgnorePatterns)
    ignore: sourceIgnorePatterns,
    cwd: 'tmp/dist'
  })
  .map((p) => path.join('tmp/dist', p));

console.log('_partialsInput', _partialsInput);

const basePlugins = [
  json(),
  resolve({ extensions: ['.js', '.cjs', '.mjs', '.json', '.node'], preferBuiltins: true }),
  commonjs({
    transformMixedEsModules: true
  }),
  esmShim()
];

const baseOutput = {
  dir: 'lib',
  sourcemap: false,
  preserveModules: true,
  preserveModulesRoot: 'tmp/dist/src'
};

/**
 * @type {import('rollup').RollupOptions}
 */
const _partials = {
  input: _partialsInput,
  output: [
    // bundle CJS
    {
      ...baseOutput,
      format: 'cjs',
      entryFileNames: entryFileNamesWithExt('cjs'),
      chunkFileNames: chunkFileNamesWithExt('cjs')
    },

    // bundle mjs as ESM
    {
      ...baseOutput,
      format: 'esm',
      entryFileNames: entryFileNamesWithExt('mjs'),
      chunkFileNames: chunkFileNamesWithExt('mjs')
    }
  ],
  plugins: basePlugins,
  external: externalPackagesFilter,
  maxParallelFileOps: 500
};

// Export shared utilities for other configurations
export { baseOutput, basePlugins, externalPackagesFilter, sourceIgnorePatterns, tsconfig, tsconfigPath };

export default _partials;
