import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import HtmlListPlugin from './scripts/list-public-html-vite-plugin.js';

export default defineConfig({
  plugins: [HtmlListPlugin(), react()],
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
