import express from 'express';
import nunjucks from 'nunjucks';
import path from 'path';
import { writefile } from 'sbg-utility';
import { getLogs } from './src/logHelper.js';

let __filename = new URL(import.meta.url).pathname;
if (process.platform === 'win32' && __filename.startsWith('/')) {
  __filename = __filename.slice(1);
}
const __dirname = path.dirname(__filename);
const templatesPath = path.join(__dirname, 'templates');
nunjucks.configure(templatesPath, { autoescape: true, watch: true, noCache: true });

// ExpressJS for live rendering
const app = express();
app.set('view engine', 'njk');
app.set('views', templatesPath);

app.get('/', (req, res) => {
  const liveLogs = getLogs();
  // Count success and fail logs (case-insensitive)
  const successCount = liveLogs.filter((log) => log.data && log.data.status === 'success').length;
  const failCount = liveLogs.filter((log) => log.data && log.data.status !== 'success').length;
  const liveHtml = nunjucks.render('log-viewer.njk', {
    logs: liveLogs,
    successCount,
    failCount
  });
  const outPath = path.resolve(__dirname, 'tmp/log-viewer.html');
  writefile(outPath, liveHtml);
  console.log(`Log HTML written to ${outPath}`);
  res.send(liveHtml);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Express server running at http://localhost:${PORT}`);
});
