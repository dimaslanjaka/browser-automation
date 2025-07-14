import crypto from 'crypto';
import express from 'express';
import nunjucks from 'nunjucks';
import path from 'path';
import { writefile } from 'sbg-utility';
import { dataKunto } from './data/index.js';
import { dbPath, getLogs } from './src/logHelper.js';
import { ucwords } from './src/utils.js';

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

app.get('/', (req, res) => {
  let liveLogs = getLogs();
  // Sort liveLogs by item.data.nik order as in dataKunto
  if (Array.isArray(dataKunto) && Array.isArray(liveLogs)) {
    const nikOrder = dataKunto.map((item) => item.nik);
    const nikIndex = (nik) => nikOrder.indexOf(nik);
    liveLogs = liveLogs.slice().sort((a, b) => {
      const nikA = a.data && a.data.nik;
      const nikB = b.data && b.data.nik;
      return nikIndex(nikA) - nikIndex(nikB);
    });
  }

  const outPath = path.resolve(__dirname, 'public/log-juli-2025.html');
  const canonicalUrl = `https://www.webmanajemen.com/browser-automation/${path.basename(outPath)}`;
  // Count success and fail logs (case-insensitive)
  const successCount = liveLogs.filter((log) => log.data && log.data.status === 'success').length;
  const failCount = liveLogs.filter((log) => log.data && log.data.status !== 'success').length;
  let pageTitle = 'Log Viewer';
  if (req.query.pageTitle || req.query.pagetitle) {
    pageTitle = ucwords(req.query.pageTitle || req.query.pagetitle);
  }
  const liveHtml = nunjucks.render('log-viewer.njk', {
    logs: liveLogs,
    successCount,
    failCount,
    pageTitle,
    canonicalUrl,
    logsJson: JSON.stringify(liveLogs)
  });
  writefile(outPath, liveHtml);
  console.log(`Log HTML written to ${outPath}`);
  res.send(liveHtml);
});

app.get('/stats', (req, res) => {
  const liveLogs = getLogs();
  const successCount = liveLogs.filter((log) => log.data && log.data.status === 'success').length;
  const failCount = liveLogs.filter((log) => log.data && log.data.status !== 'success').length;
  const dbPathChecksum = crypto.createHash('sha256').update(dbPath).digest('hex');
  res.json({ successCount, failCount, db: { dbPath, dbPathChecksum } });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Express server running at http://localhost:${PORT}`);
});
