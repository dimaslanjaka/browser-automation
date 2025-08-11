// CLI entrypoint for buildStaticHtml (ESM compatible)
import fs from 'fs';
import { buildStaticHtml, outLogsPath } from './build-static-html-vite-plugin.js';
import { decryptJson } from '../src/utils/json-crypto.js';

(async () => {
  await buildStaticHtml();
  const content = decryptJson(fs.readFileSync(outLogsPath, 'utf-8'), process.env.VITE_JSON_SECRET);
  console.log(`Logs count: ${content.length}`);
})();
