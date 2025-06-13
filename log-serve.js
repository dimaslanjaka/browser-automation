import http from 'http';
import fs from 'fs/promises';
import fssync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve __dirname untuk ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const logFilePath = path.join(__dirname, '.cache', 'log.html');

let clients = [];

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
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
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
