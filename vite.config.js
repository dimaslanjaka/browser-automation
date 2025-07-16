import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import AfterBuildCopyPlugin from './scripts/after-build-vite-plugin.js';
import dbLogHtmlStatic from './scripts/build-static-html-vite-plugin.js';
import HtmlListPlugin from './scripts/list-public-html-vite-plugin.js';

export default defineConfig({
  plugins: [
    dbLogHtmlStatic(),
    HtmlListPlugin(),
    react(),
    AfterBuildCopyPlugin()
    // import legacy from '@vitejs/plugin-legacy';
    // legacy({
    //   targets: ['defaults', 'not IE 11'],
    //   additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
    //   modernPolyfills: true,
    //   renderLegacyChunks: true
    // })
  ],
  root: '.',
  base: '/browser-automation/',
  build: {
    outDir: 'dist'
  },
  server: {
    port: 5173,
    open: false
  }
});
