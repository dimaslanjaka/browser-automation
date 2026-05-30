import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import color from 'ansi-colors';
import fs from 'fs';
import * as glob from 'glob';
import jsonc from 'jsonc-parser';
import _ from 'lodash';
import path from 'upath';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tsconfigPath = path.join(__dirname, 'tsconfig.build.json');

/**
 * @type {typeof import('./tsconfig.json')}
 */
const tsconfig = jsonc.parse(fs.readFileSync(path.join(__dirname, 'tsconfig.json'), 'utf-8'));

/**
 * @type {typeof import('./package.json')}
 */
const pkg = jsonc.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));

/**
 * Packages that should be bundled (not externalized)
 * @type {string[]}
 */
export const bundledPackages = [
  'p-limit',
  'deepmerge-ts',
  'hexo-is',
  'is-stream',
  'markdown-it',
  'node-cache',
  'is-file-stream',
  'strip-ansi',
  'ansi-regex'
];

/**
 * List external dependencies, excluding specific packages that should be bundled
 * @type {string[]}
 */
export const externalPackages = _.uniq(
  Object.keys(pkg.dependencies)
    .concat(Object.keys(pkg.devDependencies))
    .concat(
      'hexo',
      'warehouse',
      'hexo-util',
      'canvas',
      'jsdom',
      'mime-db',
      'sbg-utility',
      'through2',
      'gulp',
      'bluebird'
    )
).filter((pkgName) => !bundledPackages.includes(pkgName));

export { pkg as packageJson, tsconfig };

/**
 * Shared source exclusion patterns.
 * Used by glob input discovery and TypeScript compilation.
 *
 * @type {string[]}
 */
const sourceIgnorePatterns = [
  '**/*.runner.*',
  '**/*.explicit.*',
  '**/*.test.*',
  '**/*.builder.*',
  '**/*.spec.*',
  '*browser*',
  'src/bundle/**/*'
];

/**
 * Helper to color booleans
 *
 * @param {boolean} val
 * @returns {string}
 */
const boolColor = (val) => (val ? color.green('true') : color.red('false'));

/**
 * Normalize node_modules paths into Rollup output paths.
 *
 * @param {string} value
 * @returns {string}
 */
function normalizeNodeModulePath(value) {
  const nodeModulesIdx = value.indexOf('node_modules');

  let rel = value.slice(nodeModulesIdx);

  rel = rel.replace('node_modules', 'dependencies');

  // Remove any null bytes (\x00) that may be present
  rel = rel.replace(/\0/g, '');

  // Remove any leading slashes
  rel = rel.replace(/^\/\/+/, '');

  return rel;
}

/**
 * Returns a function to generate entry file names with the given extension for Rollup output.
 *
 * For files from node_modules, places them in the dependencies folder and logs the mapping.
 *
 * @param {string} ext The file extension (e.g. 'js', 'cjs', 'mjs').
 * @returns {(info: { facadeModuleId: string }) => string} Function that generates the output file name for a given entry.
 */
export function entryFileNamesWithExt(ext) {
  // Ensure the extension does not start with a dot
  if (ext.startsWith('.')) {
    ext = ext.slice(1);
  }

  return function ({ facadeModuleId }) {
    const normalizedFacadeModuleId = path.toUnix(facadeModuleId);

    if (!normalizedFacadeModuleId.includes('node_modules')) {
      return `[name].${ext}`;
    }

    let rel = normalizeNodeModulePath(normalizedFacadeModuleId);

    // Remove extension using upath.extname
    rel = rel.slice(0, -path.extname(rel).length) + `.${ext}`;

    fs.appendFileSync(
      'tmp/rollup.log',
      `entryFileNamesWithExt:\n  [facadeModuleId] ${normalizedFacadeModuleId}\n  [rel] ${rel}\n`
    );

    return rel;
  };
}

/**
 * Returns a function to generate chunk file names with the given extension for Rollup output.
 *
 * For chunks from node_modules, places them in the dependencies folder and removes the original extension.
 *
 * @param {string} ext The file extension (e.g. 'js', 'cjs', 'mjs').
 * @returns {(info: { name: string }) => string} Function that generates the output file name for a given chunk.
 */
export function chunkFileNamesWithExt(ext) {
  return function ({ name }) {
    // For node_modules chunks, place in dependencies folder
    if (name && name.includes('node_modules')) {
      let rel = normalizeNodeModulePath(name);

      // Remove extension using upath.extname
      rel = rel.slice(0, -path.extname(rel).length);

      return `${rel}-[hash].${ext}`;
    }

    // For local chunks, keep the default pattern
    return `[name]-[hash].${ext}`;
  };
}

/**
 * Rollup external filter function.
 * Determines if a module should be treated as external (not bundled) or bundled.
 *
 * @param {string} source - The import path or module ID.
 * @param {string} importer - The path of the importing file.
 * @param {boolean} isResolved - Whether the import has been resolved.
 * @returns {boolean} True if the module should be external, false if it should be bundled.
 */
export function externalPackagesFilter(source, importer, isResolved) {
  /**
   * @param {string} source
   * @returns {string}
   */
  function getPackageNameFromSource(source) {
    // Handle absolute paths (Windows/Unix)
    const nm = /node_modules[\\/]+([^\\/]+)(?:[\\/]+([^\\/]+))?/.exec(source);

    if (nm) {
      // Scoped package
      if (nm[1].startsWith('@') && nm[2]) {
        return `${nm[1]}/${nm[2]}`;
      }

      return nm[1];
    }

    // Handle bare imports
    if (source.startsWith('@')) {
      return source.split('/').slice(0, 2).join('/');
    }

    return source.split('/')[0];
  }

  const pkgName = getPackageNameFromSource(source);
  const isBundled = bundledPackages.includes(pkgName);
  const isExternal = externalPackages.includes(pkgName);

  if (bundledPackages.some((pkg) => source.includes(pkg))) {
    const treeLog = [
      color.bold(color.cyan('externalFilter')),
      `\t├─ ${color.cyan('source:')}     ${color.yellow(source)}`,
      `\t├─ ${color.cyan('pkgName:')}    ${color.yellow(pkgName)}`,
      `\t├─ ${color.cyan('external:')}   ${boolColor(isExternal)}`,
      `\t├─ ${color.cyan('bundled:')}    ${boolColor(isBundled)}`,
      `\t├─ ${color.cyan('importer:')}   ${color.yellow((importer || '-').replace(process.cwd(), '').replace(/^\//, ''))}`,
      `\t└─ ${color.cyan('isResolved:')} ${boolColor(isResolved)}`
    ].join('\n');

    console.log(treeLog);
  }

  if (isBundled) return false; // <-- force bundle
  if (isExternal) return true; // <-- mark as external
  return false; // fallback: bundle it
}

/**
 * @type {import('rollup').RollupOptions['input']}
 */
const _nodeInputs = glob.globSync(['src/{puppeteer,database}/**/*.{ts,js,cjs,mjs}', 'src/index.ts'], {
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
  commonjs()
];

/**
 * @type {import('rollup').RollupOptions}
 */
const _partials = {
  input: 'src/index.ts',
  output: [
    // bundle CJS
    {
      dir: 'lib',
      format: 'cjs',
      sourcemap: false,
      preserveModules: true,
      preserveModulesRoot: 'src',
      entryFileNames: entryFileNamesWithExt('cjs'),
      chunkFileNames: chunkFileNamesWithExt('cjs')
      // exports: 'named'
    },

    // bundle mjs as ESM
    {
      dir: 'lib',
      format: 'esm',
      sourcemap: false,
      preserveModules: true,
      preserveModulesRoot: 'src',
      entryFileNames: entryFileNamesWithExt('mjs'),
      chunkFileNames: chunkFileNamesWithExt('mjs')
      // exports: 'named'
    }
  ],
  plugins: basePlugins,
  external: externalPackagesFilter // External dependencies package name to exclude from bundle
};

export default [_partials];
