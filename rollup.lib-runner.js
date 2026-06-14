import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import * as glob from 'glob';
import esmShim from '@rollup/plugin-esm-shim';
import { entryFileNamesWithExt, chunkFileNamesWithExt, externalPackagesFilter } from './rollup-utils.js';
import { tsconfig, tsconfigPath, baseOutput } from './rollup.lib.js';

/**
 * Runner-specific input files
 *
 * @type {import('rollup').RollupOptions['input']}
 */
const _runnerInputs = glob
  .globSync(['src/**/*.runner.*'], {
    posix: true,
    ignore: tsconfig.exclude.concat('**/_*')
  })
  .filter((p) => p.includes('parallel'));

console.log('_runnerInputs', _runnerInputs);

const runnerPlugins = [
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

/**
 * Runner compilation configuration
 *
 * @type {import('rollup').RollupOptions}
 */
const runnerConfig = {
  input: _runnerInputs,
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
  plugins: runnerPlugins,
  external: externalPackagesFilter,
  maxParallelFileOps: 500
};

export default runnerConfig;
