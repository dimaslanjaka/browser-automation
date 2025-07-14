import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import AfterBuildCopyPlugin from './scripts/after-build-vite-plugin.js';
import HtmlListPlugin from './scripts/list-public-html-vite-plugin.js';

export default defineConfig({
  plugins: [HtmlListPlugin(), react(), AfterBuildCopyPlugin()],
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
