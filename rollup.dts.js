import path from 'upath';
import { dts } from 'rollup-plugin-dts';
import { externalPackagesFilter } from './rollup-utils.js';
import { fileURLToPath } from 'node:url';
import jsonc from 'jsonc-parser';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/**
 * @type {typeof import('./tsconfig.json')}
 */
const tsconfig = jsonc.parse(fs.readFileSync(path.join(__dirname, 'tsconfig.dts.json'), 'utf-8'));

/**
 * Declaration bundle
 *
 * @type {import('rollup').RollupOptions[]}
 */
const dtsConfigs = tsconfig.include.map((entry) => {
  const rel = path.relative('src', entry);
  const output = path.join('dist', rel).replace(/\.(ts|mts|cts)$/, '.d.ts');

  return {
    input: entry,
    output: {
      file: output,
      format: 'es'
    },
    plugins: [
      dts({
        tsconfig: 'tsconfig.dts.json'
      })
    ],
    external: externalPackagesFilter
  };
});

export default dtsConfigs;
