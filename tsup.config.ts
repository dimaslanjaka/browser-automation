import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/**/*.js', 'src/**/*.cjs', 'src/**/*.mjs', 'src/**/*.ts'],
  outDir: 'dist',
  format: ['esm', 'cjs'],
  splitting: true,
  sourcemap: true,
  clean: true,
  dts: false,
  treeshake: true,
  bundle: false,
  minify: false,
  target: 'node16',
  shims: false
});
