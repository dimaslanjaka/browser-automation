import path from 'path';
import { fileURLToPath } from 'url';
import * as databaseModule from '../../dist/database/index.mjs';
import { toValidMySQLDatabaseName } from '../database/db_utils.js';
import cors from 'cors';
import express from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { MYSQL_HOST, MYSQL_USER, MYSQL_PASS, MYSQL_PORT } = process.env;
const database = new databaseModule.LogDatabase(toValidMySQLDatabaseName('skrin_' + process.env.DATABASE_FILENAME), {
  connectTimeout: 60000,
  connectionLimit: 10,
  host: MYSQL_HOST || 'localhost',
  user: MYSQL_USER || 'root',
  password: MYSQL_PASS || '',
  port: Number(MYSQL_PORT) || 3306,
  type: MYSQL_HOST ? 'mysql' : 'sqlite'
});

// Simple Express server to expose log database over HTTP
const app = express();
app.use(cors());
app.use(express.json());

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Index: show all logs in simple HTML linking to /logs/:id
app.get('/', async (req, res) => {
  try {
    const { limit } = req.query;
    const options = {};
    if (limit) options.limit = Number(limit);
    const logs = await database.getLogs(() => true, options);

    const rows = logs
      .map(
        (l) =>
          `<tr><td><a href="/logs/${encodeURIComponent(l.id)}">${escapeHtml(l.id)}</a></td><td>${escapeHtml(
            l.timestamp
          )}</td><td>${escapeHtml(l.message)}</td></tr>`
      )
      .join('\n');

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Skrin logs</title>
  <style>table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px}</style>
</head>
<body>
  <h1>Skrin logs (${logs.length})</h1>
  <table>
    <thead><tr><th>ID</th><th>Timestamp</th><th>Message</th></tr></thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Failed to render index', err);
    res.status(500).send('Internal Server Error');
  }
});

// GET /logs?limit=100&offset=0&q=search
app.get('/logs', async (req, res) => {
  try {
    const { limit, offset, q } = req.query;
    const options = {};
    if (limit) options.limit = Number(limit);
    if (offset) options.offset = Number(offset);

    let logs = await database.getLogs(() => true, options);
    if (q) {
      const qStr = String(q);
      logs = logs.filter((l) => {
        try {
          return (
            String(l.id).includes(qStr) ||
            JSON.stringify(l.data || '').includes(qStr) ||
            String(l.message || '').includes(qStr)
          );
        } catch (e) {
          return false;
        }
      });
    }

    res.json({ ok: true, count: logs.length, rows: logs });
  } catch (err) {
    console.error('Failed to get logs', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// GET /logs/:id
app.get('/logs/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const log = await database.getLogById(id);
    if (!log) return res.status(404).json({ ok: false, error: 'not_found' });
    // If client requests HTML, render simple HTML view
    const wantsHtml = req.query.format === 'html' || (req.headers.accept || '').includes('text/html');
    if (wantsHtml) {
      const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Log ${escapeHtml(log.id)}</title>
  <style>pre{white-space:pre-wrap;word-break:break-word}body{font-family:Arial,Helvetica,sans-serif;padding:16px}</style>
</head>
<body>
  <a href="/">← Back</a>
  <h1>Log ${escapeHtml(log.id)}</h1>
  <p><strong>Timestamp:</strong> ${escapeHtml(log.timestamp)}</p>
  <p><strong>Message:</strong> ${escapeHtml(log.message)}</p>
  <h2>Data</h2>
  <pre>${escapeHtml(JSON.stringify(log.data, null, 2))}</pre>
</body>
</html>`;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(html);
    }

    res.json({ ok: true, log });
  } catch (err) {
    console.error('Failed to get log', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

const PORT = Number(process.env.PORT) || 3000;
const server = app.listen(PORT, () => {
  console.log(`Skrin log server listening at http://localhost:${PORT}`);
});

// Graceful shutdown
function shutdown() {
  console.log('Shutting down skrin log server...');
  try {
    server.close(() => {
      try {
        if (database && typeof database.close === 'function') database.close();
      } catch (e) {
        console.error('Error closing database during shutdown', e);
      }
      process.exit(0);
    });
  } catch (e) {
    console.error('Shutdown error', e);
    process.exit(1);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
