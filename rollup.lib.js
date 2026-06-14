import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import fs from 'fs';
import * as glob from 'glob';
import jsonc from 'jsonc-parser';
import path from 'upath';
import { fileURLToPath } from 'url';
import { dts } from 'rollup-plugin-dts';
import esmShim from '@rollup/plugin-esm-shim';
import { entryFileNamesWithExt, chunkFileNamesWithExt, externalPackagesFilter } from './rollup-utils.js';

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
const _nodeInputs = glob.globSync(['src/{puppeteer,database,utils}/**/index*.{ts,js,cjs,mjs}', 'src/index.ts'], {
  posix: true,
  ignore: tsconfig.exclude.concat(sourceIgnorePatterns)
});

const basePlugins = [
  typescript({
    tsconfig: tsconfigPath,
    compilerOptions: {
      outDir: 'lib',
      declaration: false,
      declarationMap: false
    }
  }),
  resolve({ preferBuiltins: true }),
  commonjs(),
  esmShim()
];

const baseOutput = {
  dir: 'lib',
  sourcemap: false,
  preserveModules: true,
  preserveModulesRoot: 'src'
};

const _partialsInput = [
  ...new Set(['src/index.ts', 'src/database/index.ts', 'src/puppeteer/index.ts', ..._nodeInputs])
];

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

const dtsEntries = ['src/index.ts', 'src/database/index.ts', 'src/puppeteer/index.ts'];

/**
 * Declaration bundle
 *
 * @type {import('rollup').RollupOptions[]}
 */
const dtsConfigs = dtsEntries.map((entry) => {
  const rel = path.relative('src', entry);
  const output = path.join('lib', rel).replace(/\.(ts|mts|cts)$/, '.d.ts');

  return {
    input: entry,
    output: {
      file: output,
      format: 'es'
    },
    plugins: [
      dts({
        tsconfig: tsconfigPath
      })
    ],
    external: externalPackagesFilter
  };
});

// Export shared utilities for runner config
export { tsconfig, tsconfigPath, basePlugins, baseOutput, sourceIgnorePatterns, externalPackagesFilter };

export default [_partials, ...dtsConfigs];
