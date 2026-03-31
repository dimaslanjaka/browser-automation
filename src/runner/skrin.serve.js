import path from 'path';
import { fileURLToPath } from 'url';
import * as databaseModule from '../../dist/database/index.mjs';
import { toValidMySQLDatabaseName } from '../database/db_utils.js';
import cors from 'cors';
import express from 'express';
import crypto from 'crypto';

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

// (SSE removed) — live reload now uses `/checksum` polling from clients

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function timeAgo(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (isNaN(d.getTime())) return String(ts);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 5) return 'just now';
  if (sec < 60) return sec + ' seconds ago';
  const min = Math.floor(sec / 60);
  if (min < 60) return min + ' minutes ago';
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + ' hours ago';
  const days = Math.floor(hr / 24);
  if (days < 30) return days + ' days ago';
  return d.toLocaleString();
}

// Index: show all logs in simple HTML linking to /logs/:id
app.get('/', async (req, res) => {
  try {
    const { limit } = req.query;
    const options = {};
    if (limit) options.limit = Number(limit);
    let logs = await database.getLogs(() => true, options);
    // sort logs by latest timestamp first
    logs = logs.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));

    const rows = logs
      .map((l) => {
        const tdisplay = timeAgo(l.timestamp);
        return `<tr><td><a href="/logs/${encodeURIComponent(l.id)}">${escapeHtml(l.id)}</a></td><td>${escapeHtml(
          tdisplay
        )}</td><td>${escapeHtml(l.message)}</td></tr>`;
      })
      .join('\n');

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Skrin logs</title>
  <style>
    /* shrink table to fit content and avoid empty space in cells */
    table{border-collapse:collapse; width:auto; display:inline-table; table-layout:auto}
    th,td{border:1px solid #ddd; padding:8px; white-space:nowrap}
  </style>
</head>
<body>
  <h1>Skrin logs (${logs.length})</h1>
  <table>
    <thead><tr><th>ID</th><th>Time</th><th>Message</th></tr></thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
    <script>
      (function(){
        try{
          // Poll checksum endpoint and reload when it changes
          var last = null;
          var pollMs = Number(new URLSearchParams(location.search).get('poll')) || ${_pollIntervalMs};
          function check(){
            fetch('/checksum').then(function(r){ return r.json(); }).then(function(j){
              if (j && j.ok && j.checksum){
                if (last && last !== j.checksum){ try{ location.reload(true); } catch(e){ location.reload(); } }
                last = j.checksum;
              }
            }).catch(function(){/* ignore */});
          }
          check();
          setInterval(check, pollMs);
        }catch(e){ /* ignore */ }
      })();
    </script>
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

// Checksum endpoint: returns a checksum representing table state
app.get('/checksum', async (req, res) => {
  try {
    // Try a cheap SQL-based checksum if supported
    if (typeof database.query === 'function') {
      try {
        const rows = await database.query('SELECT COUNT(*) as c, MAX(timestamp) as m FROM logs');
        // rows can be array or [[rows]] depending on DB driver; normalize
        const row = Array.isArray(rows) && rows.length ? rows[0] : rows;
        const count = row && (row.c ?? row.count ?? row['COUNT(*)']) ? (row.c ?? row.count ?? row['COUNT(*)']) : 0;
        const maxTs =
          row && (row.m ?? row.max ?? row['MAX(timestamp)']) ? (row.m ?? row.max ?? row['MAX(timestamp)']) : '';
        const payload = String(count) + '|' + String(maxTs);
        const checksum = crypto.createHash('sha1').update(payload).digest('hex');
        return res.json({ ok: true, checksum });
      } catch (e) {
        // fall through to slower fallback below
        /* ignore */
      }
    }

    // Fallback: fetch minimal data via getLogs
    const logs = await database.getLogs(() => true, { limit: 1 });
    const latest = logs && logs.length ? logs[0] : null;
    const payload = latest ? `${latest.id}:${latest.timestamp}` : 'empty';
    const checksum = crypto.createHash('sha1').update(payload).digest('hex');
    res.json({ ok: true, checksum });
  } catch (err) {
    console.error('Failed to compute checksum', err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

const PORT = Number(process.env.PORT) || 3000;
const server = app.listen(PORT, () => {
  console.log(`Skrin log server listening at http://localhost:${PORT}`);
});

// Client-side poll interval (used in injected index script)
const _pollIntervalMs = Number(process.env.SKRIN_POLL_MS) || 3000;

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
