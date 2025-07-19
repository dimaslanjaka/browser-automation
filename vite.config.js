import legacy from '@vitejs/plugin-legacy';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import mkcert from 'vite-plugin-mkcert';
import AfterBuildCopyPlugin from './scripts/after-build-vite-plugin.js';
import dbLogHtmlStatic from './scripts/build-static-html-vite-plugin.js';
import HtmlListPlugin from './scripts/list-public-html-vite-plugin.js';
import RedirectBrowserAutomationPlugin from './scripts/redirect-browser-automation-plugin.js';
import SitemapVitePlugin from './scripts/sitemap-vite-plugin.js';

/**
 * Vite configuration for browser-automation project.
 *
 * - Uses React and legacy browser support plugins.
 * - Custom plugins for after-build copy, static HTML generation, and HTML listing.
 * - Output directory: dist
 * - Base path: /browser-automation/
 * - Dev server: port 5173, does not auto-open browser.
 *
 * @see https://vitejs.dev/config/
 * @type {import('vite').UserConfig}
 */
export default defineConfig({
  plugins: [
    mkcert(),
    RedirectBrowserAutomationPlugin(),
    dbLogHtmlStatic(),
    HtmlListPlugin(),
    react(),
    AfterBuildCopyPlugin(),
    legacy({
      targets: ['defaults', 'not IE 11'],
      additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      modernPolyfills: true,
      renderLegacyChunks: true
    }),
    SitemapVitePlugin({
      baseUrl: 'https://www.webmanajemen.com/browser-automation',
      outDir: 'dist',
      exclude: ['**/404.html']
    })
  ],
  root: '.',
  base: '/browser-automation/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      // https://rollupjs.org/configuration-options/
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          'react-router': ['react-router', 'react-router-dom'],
          bootstrap: ['bootstrap', 'react-bootstrap'],
          highlight: ['highlight.js'],
          'nik-parser': ['nik-parser-jurusid'],
          moment: ['moment', 'moment-timezone'],
          axios: ['axios'],
          'deepmerge-ts': ['deepmerge-ts']
        }
      }
    }
  },
  server: {
    host: 'dev.webmanajemen.com',
    port: 5173,
    open: false
  }
});
