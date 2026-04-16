import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import alias from '@rollup/plugin-alias';
import fs from 'fs';
import path from 'path';

const inputFile = process.env.BUNDLE_INPUT || 'src/index.ts';
const outputFile = process.env.BUNDLE_OUTPUT || 'dist/bundle.cjs';

const isTypeScript = /\.(ts|tsx)$/.test(inputFile);

export default {
  input: inputFile,
  output: {
    file: outputFile,
    format: 'cjs',
    sourcemap: true
  },
  plugins: [
    alias({
      entries: [
        // Add custom aliases here if needed
      ]
    }),
    json(),
    resolve({ preferBuiltins: true, extensions: ['.js', '.mjs', '.cjs', '.ts', '.json', '.node'] }),
    ...(isTypeScript
      ? [
          typescript({
            tsconfig: false,
            noEmitOnError: false,
            noEmit: false,
            outDir: undefined // Prevent plugin from setting outDir
          })
        ]
      : []),
    commonjs({ extensions: ['.js', '.mjs', '.cjs', '.ts', '.json', '.node'] })
  ],
  // Mark all installed dependencies and devDependencies as external
  external: [
    ...(() => {
      const pkgPath = path.join(process.cwd(), 'package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      return [...Object.keys(pkg.dependencies || {}), ...Object.keys(pkg.devDependencies || {})];
    })()
  ]
};
