/* eslint-disable no-useless-escape */
import { spawnAsync } from 'cross-spawn';
import fssync from 'fs';
import fs from 'fs/promises';
import * as glob from 'glob';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname untuk ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Find all HTML files in .cache directory
const htmlFiles = glob.sync('**/*.html', { cwd: path.join(__dirname, 'public'), posix: true, absolute: true });
const staticDir = path.join(__dirname, 'public'); // Directory for static files

let clients = [];

// Helper to get mime type from extension
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};
function getMimeType(filePath) {
  return mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

const customHtml = `
<!-- Live Reload Script -->
<script>
  const evtSource = new EventSource("/events");
  evtSource.onmessage = () => location.reload();
</script>
<!-- Button to trigger log rebuild -->
<style>
  #buildButton {
    position: fixed;
    top: 1rem;
    right: 1rem;
    z-index: 50;
    padding: 0.5rem 1rem;
    background-color: #2563eb;
    color: #fff;
    font-weight: 600;
    border-radius: 0.5rem;
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);
    border: none;
    transition: background-color 0.2s;
    outline: none;
  }
  #buildButton:hover {
    background-color: #1d4ed8;
  }
  #buildButton:focus {
    box-shadow: 0 0 0 2px #60a5fa;
  }
  #snackbar {
    visibility: hidden;
    min-width: 250px;
    background-color: #323232;
    color: #fff;
    text-align: center;
    border-radius: 0.5rem;
    padding: 1rem;
    position: fixed;
    left: 50%;
    bottom: 2rem;
    transform: translateX(-50%);
    z-index: 100;
    font-size: 1rem;
    opacity: 0;
    transition: opacity 0.3s, visibility 0.3s;
  }
  #snackbar.show {
    visibility: visible;
    opacity: 1;
  }
</style>
<button id="buildButton" type="button">Rebuild Logs</button>
<div id="snackbar"></div>
<script>
  function showSnackbar(message) {
    const snackbar = document.getElementById('snackbar');
    snackbar.textContent = message;
    snackbar.classList.add('show');
    setTimeout(() => {
      snackbar.classList.remove('show');
    }, 3000);
  }

  document.getElementById('buildButton').addEventListener('click', () => {
    fetch('/build')
      .then(response => response.text())
      .then(data => {
        showSnackbar(data);
        setTimeout(() => location.reload(), 1200);
      })
      .catch(err => {
        console.error('Error rebuilding logs:', err);
        showSnackbar('Error rebuilding logs');
      });
  });
</script>
`;

function injectLiveReload(html) {
  // Prefer to inject before </body>, else append
  return html.includes('</body>') ? html.replace('</body>', `${customHtml}\n</body>`) : html + customHtml;
}

async function serveHtmlFile(filePath, res) {
  try {
    let html = await fs.readFile(filePath, 'utf8');
    html = injectLiveReload(html);
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Error loading file: ' + err.message);
  }
}

function sanitizePath(url) {
  // Prevent directory traversal, decode URI, normalize
  return path.normalize(decodeURIComponent(url)).replace(/^(\.\.[\/\\])+/, '');
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url === '/') {
      // Directory listing for public HTML files
      res.writeHead(200, { 'Content-Type': 'text/html' });
      const listItems = htmlFiles
        .map((file) => {
          const name = path.basename(file);
          return `<li><a href="/${name}">${name}</a></li>`;
        })
        .join('\n');
      res.end(`
        <h1>Available Log Files</h1>
        <ul>
          ${listItems}
        </ul>
        ${customHtml}
      `);
      return;
    }

    if (req.url === '/events') {
      // SSE: Server-Sent Events for live reload
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      });
      res.write('\n');
      clients.push(res);
      req.on('close', () => {
        clients = clients.filter((client) => client !== res);
      });
      return;
    }

    let building = false;
    if (req.url === '/build') {
      // Trigger log file rebuild
      if (!building) {
        building = true;
        spawnAsync('node', [path.join(__dirname, 'log-builder.js')], { stdio: 'inherit' }).catch(console.error);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Log files rebuilt in background. Check console for details.');
      } else {
        res.writeHead(503, { 'Content-Type': 'text/plain' });
        res.end('Rebuild already in progress. Please wait.');
      }
      return;
    }

    // Serve static files from /public
    const safePath = sanitizePath(req.url);
    const filePath = path.join(staticDir, safePath);

    // Prevent directory traversal
    if (!filePath.startsWith(staticDir)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    let stat;
    try {
      stat = await fs.stat(filePath);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }

    if (!stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not a file');
      return;
    }

    if (filePath.endsWith('.html')) {
      await serveHtmlFile(filePath, res);
    } else {
      const data = await fs.readFile(filePath);
      res.writeHead(200, { 'Content-Type': getMimeType(filePath) });
      res.end(data);
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Internal server error: ' + err.message);
  }
});

// Watch file for changes and trigger live reload
for (const file of htmlFiles) {
  fssync.watch(file, () => {
    for (const client of clients) {
      client.write('data: reload\n\n');
    }
  });
}

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Live server running at http://localhost:${PORT}`);
});
