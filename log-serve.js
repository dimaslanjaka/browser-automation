/* eslint-disable no-useless-escape */
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
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.html':
      return 'text/html';
    case '.css':
      return 'text/css';
    case '.js':
      return 'application/javascript';
    case '.json':
      return 'application/json';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    case '.ico':
      return 'image/x-icon';
    default:
      return 'application/octet-stream';
  }
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/' || req.url === '/log.html') {
    try {
      let html = await fs.readFile(logFilePath, 'utf8');
      // Inject live reload script
      html += `
        <script>
          const evtSource = new EventSource("/events");
          evtSource.onmessage = () => location.reload();
        </script>`;
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Error loading file: ' + err.message);
    }
  } else if (req.url === '/events') {
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
  } else {
    // Try to serve static files from /public
    const safePath = path.normalize(decodeURIComponent(req.url)).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(staticDir, safePath);

    try {
      // Prevent directory traversal
      if (!filePath.startsWith(staticDir)) {
        throw new Error('Forbidden');
      }
      const stat = await fs.stat(filePath);
      if (stat.isFile()) {
        const data = await fs.readFile(filePath);
        res.writeHead(200, { 'Content-Type': getMimeType(filePath) });
        res.end(data);
        return;
      } else {
        throw new Error('Not a file');
      }
    } catch (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found: ' + err.message);
    }
  }
});

// Watch file for changes
fssync.watch(logFilePath, () => {
  for (const client of clients) {
    client.write('data: reload\n\n');
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Live server running at http://localhost:${PORT}`);
});
