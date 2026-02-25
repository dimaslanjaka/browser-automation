import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import dts from 'rollup-plugin-dts';
import { readFileSync } from 'fs';
import path from 'path';
import url from 'url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkg = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

/** All dependencies including dev */
const external = Object.keys(pkg.dependencies || {}).concat(Object.keys(pkg.devDependencies || {}));

const inputFile = process.env.SKRIN_INPUT || 'src/runner/skrin2.js';
const outputFile = process.env.SKRIN_OUTPUT || 'dist/skrin2.bundle.cjs';
const isTypeScriptInput = path.extname(inputFile).toLowerCase() === '.ts';

/** @type {import('rollup').RollupOptions} */
const skrinConfig = {
  input: inputFile,
  external,
  output: {
    file: outputFile,
    format: 'cjs',
    sourcemap: true
  },
  plugins: [
    json(),
    resolve({ preferBuiltins: true, extensions: ['.js', '.mjs', '.cjs', '.ts', '.json', '.node'] }),
    ...(isTypeScriptInput ? [typescript()] : []),
    commonjs({ extensions: ['.js', '.mjs', '.cjs', '.ts', '.json', '.node'] })
    // babel({ babelHelpers: 'bundled', extensions: ['.js', '.mjs', '.cjs', '.ts'], exclude: 'node_modules/**' })
  ]
};

/** @type {import('rollup').RollupOptions} */
const databaseConfig = {
  input: 'src/database/index.ts',
  external,
  output: [
    {
      dir: 'dist/database',
      format: 'cjs',
      preserveModules: true,
      preserveModulesRoot: 'src/database',
      entryFileNames: '[name].cjs',
      sourcemap: true
    },
    {
      dir: 'dist/database',
      format: 'esm',
      preserveModules: true,
      preserveModulesRoot: 'src/database',
      entryFileNames: '[name].mjs',
      sourcemap: true
    }
  ],
  plugins: [
    json(),
    resolve({ preferBuiltins: true, extensions: ['.js', '.mjs', '.cjs', '.ts', '.json', '.node'] }),
    typescript({ compilerOptions: { outDir: 'dist/database' } }),
    commonjs({ extensions: ['.js', '.mjs', '.cjs', '.ts', '.json', '.node'] })
  ]
};

/** @type {import('rollup').RollupOptions} */
const databaseDtsConfig = {
  input: 'src/database/index.ts',
  output: [
    {
      dir: 'dist/database',
      format: 'es',
      preserveModules: true,
      preserveModulesRoot: 'src/database',
      entryFileNames: '[name].d.cts'
    },
    {
      dir: 'dist/database',
      format: 'es',
      preserveModules: true,
      preserveModulesRoot: 'src/database',
      entryFileNames: '[name].d.mts'
    }
  ],
  plugins: [dts()]
};

/** @type {import('rollup').RollupOptions} */
const directProcessDataConfig = {
  input: 'src/runner/skrin/direct-process-data.ts',
  external,
  output: [
    {
      dir: 'dist/runner/skrin',
      format: 'cjs',
      preserveModules: true,
      preserveModulesRoot: 'src/runner/skrin',
      entryFileNames: '[name].cjs',
      sourcemap: true
    },
    {
      dir: 'dist/runner/skrin',
      format: 'esm',
      preserveModules: true,
      preserveModulesRoot: 'src/runner/skrin',
      entryFileNames: '[name].mjs',
      sourcemap: true
    }
  ],
  plugins: [
    json(),
    resolve({ preferBuiltins: true, extensions: ['.js', '.mjs', '.cjs', '.ts', '.json', '.node'] }),
    typescript({ compilerOptions: { outDir: 'dist/runner/skrin' } }),
    commonjs({ extensions: ['.js', '.mjs', '.cjs', '.ts', '.json', '.node'] })
  ]
};

/** @type {import('rollup').RollupOptions} */
const directProcessDataDtsConfig = {
  input: 'src/runner/skrin/direct-process-data.ts',
  output: [
    {
      dir: 'dist/runner/skrin',
      format: 'es',
      preserveModules: true,
      preserveModulesRoot: 'src/runner/skrin',
      entryFileNames: '[name].d.cts'
    },
    {
      dir: 'dist/runner/skrin',
      format: 'es',
      preserveModules: true,
      preserveModulesRoot: 'src/runner/skrin',
      entryFileNames: '[name].d.mts'
    }
  ],
  plugins: [dts()]
};

export default [databaseConfig, databaseDtsConfig, directProcessDataConfig, directProcessDataDtsConfig, skrinConfig];
