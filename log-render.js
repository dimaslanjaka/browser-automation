import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import * as glob from 'glob';
import { minify as minifyHtml } from 'html-minifier-terser';
import http from 'http';
import nunjucks from 'nunjucks';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { buildStaticHtml } from './scripts/build-static-html-vite-plugin.js';
import { dbPath, getLogs } from './src/logHelper.js';
import { ucwords } from './src/utils/string.js';

let __filename = new URL(import.meta.url).pathname;
if (process.platform === 'win32' && __filename.startsWith('/')) {
  __filename = __filename.slice(1);
}
const __dirname = path.dirname(__filename);
const templatesPath = path.join(__dirname, 'templates');
nunjucks.configure(templatesPath, { autoescape: true, watch: true, noCache: true });

// ExpressJS for live rendering
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'njk');
app.set('views', templatesPath);

// Live reload integration
const server = http.createServer(app);
const io = new SocketIOServer(server);

app.get('/', async (req, res) => {
  let pageTitle = 'Log Viewer';
  if (req.query.pageTitle || req.query.pagetitle) {
    pageTitle = ucwords(req.query.pageTitle || req.query.pagetitle);
  }
  let liveHtml = await buildStaticHtml({ pageTitle });
  if (req.query.minify) {
    // Use html-minifier-terser for proper HTML minification
    liveHtml = await minifyHtml(liveHtml, {
      collapseWhitespace: true,
      removeComments: true,
      minifyCSS: true,
      minifyJS: true,
      removeRedundantAttributes: true,
      removeEmptyAttributes: true,
      useShortDoctype: true,
      removeOptionalTags: true
    });
  }
  // Inject live reload scripts only if ?live=true is present
  if (req.query.live === 'true') {
    liveHtml += '<script src="/socket.io/socket.io.js"></script>' + '<script src="/reload.js"></script>';
  }
  res.send(liveHtml);
});

// Watch for changes in logs and notify clients
fs.watch(dbPath, { persistent: true }, (eventType) => {
  if (eventType === 'change') {
    io.emit('reload');
  }
});

// Serve a small client script for live reload
app.get('/reload.js', (req, res) => {
  res.type('application/javascript').send(`
    (() => {
      const socket = window.io ? window.io() : (window.io = window.io || require('socket.io-client'))();
      socket.on('reload', () => {
        window.location.reload();
      });
    })();
  `);
});

app.get('/stats', (req, res) => {
  const liveLogs = getLogs();
  const successCount = liveLogs.filter((log) => log.data && log.data.status === 'success').length;
  const failCount = liveLogs.filter((log) => log.data && log.data.status !== 'success').length;
  const dbPathChecksum = crypto.createHash('sha256').update(dbPath).digest('hex');
  res.json({ successCount, failCount, db: { dbPath, dbPathChecksum } });
});

// Dynamically load and use all routers from src/routers using glob and dynamic import
const routersPath = path.join(__dirname, 'src/routers');
async function loadRouters() {
  if (fs.existsSync(routersPath)) {
    const routerFiles = glob.sync('**/*.js', { cwd: routersPath, absolute: true });
    for (const file of routerFiles) {
      // Convert Windows path to file:// URL for dynamic import
      let fileUrl = file;
      if (!fileUrl.startsWith('file://')) {
        fileUrl = 'file://' + (fileUrl.startsWith('/') ? '' : '/') + fileUrl.replace(/\\/g, '/');
      }
      const routerModule = await import(fileUrl);
      const router = routerModule.default || routerModule;
      if (router && typeof router === 'function') {
        // Mount router at its filename (without extension)
        const routeBase = '/' + path.basename(file, path.extname(file));
        app.use(routeBase, router);
      }
    }
  }
}

loadRouters()
  .then(() => {
    console.log('All routers loaded successfully');

    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`Express server with live reload running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Error loading routers:', err);
  });
