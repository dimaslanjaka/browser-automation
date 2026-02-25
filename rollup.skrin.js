import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import { readFileSync } from 'fs';
import path from 'path';
import url from 'url';

const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkg = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8'));

/** All dependencies including dev */
const external = Object.keys(pkg.dependencies || {}).concat(Object.keys(pkg.devDependencies || {}));

const inputFile = process.env.SKRIN_INPUT || 'src/runner/skrin2.js';

/** @type {import('rollup').RollupOptions} */
export default {
  input: inputFile,
  external,
  output: {
    file: 'dist/skrin2.bundle.cjs',
    format: 'cjs',
    sourcemap: true
  },
  plugins: [
    json(),
    resolve({ preferBuiltins: true, extensions: ['.js', '.mjs', '.cjs'] }),
    commonjs({ extensions: ['.js', '.mjs', '.cjs'] })
    // babel({ babelHelpers: 'bundled', extensions: ['.js', '.mjs', '.cjs', '.ts'], exclude: 'node_modules/**' })
  ]
};
