/* eslint-disable no-useless-escape */
import { spawnAsync } from 'cross-spawn';
import fssync from 'fs';
import fs from 'fs/promises';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname untuk ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logFilePath = path.join(__dirname, '.cache', 'log.html');
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
<button
  id="buildButton"
  class="fixed top-4 right-4 z-50 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
  type="button"
>
  Rebuild Logs
</button>
<script>
  document.getElementById('buildButton').addEventListener('click', () => {
    fetch('/build')
      .then(response => response.text())
      .then(data => {
        alert(data);
        location.reload();
      })
      .catch(err => console.error('Error rebuilding logs:', err));
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
    if (req.url === '/' || req.url === '/log.html') {
      await serveHtmlFile(logFilePath, res);
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
        spawnAsync('node', [path.join(__dirname, 'log-builder.js')], { stdio: 'inherit' })
          .then(() => {
            spawnAsync('node', [path.join(__dirname, 'new-log-builder.js')], { stdio: 'inherit' })
              .then(() => {
                building = false;
              })
              .catch(console.error);
          })
          .catch(console.error);
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
fssync.watch(logFilePath, () => {
  for (const client of clients) {
    client.write('data: reload\n\n');
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Live server running at http://localhost:${PORT}`);
});
