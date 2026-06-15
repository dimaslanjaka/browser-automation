import path from 'upath';
import { dts } from 'rollup-plugin-dts';
import { tsconfigPath, externalPackagesFilter } from './rollup.lib.js';

const dtsEntries = [
  'src/index.ts',
  'src/database/index.ts',
  'src/puppeteer/index.ts',
  'src/puppeteer/parallel/EndpointManager.ts',
  'src/puppeteer/parallel/EndpointManager.connector.ts'
];

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

export default dtsConfigs;
