import fs from 'fs';
import path from 'path';
import { writefile } from 'sbg-utility';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function writeHtmlList() {
  const publicDir = path.join(__dirname, '../public');
  const tmpDir = path.join(__dirname, '../tmp');
  const outputFile = path.join(tmpDir, 'html-files.json');
  const files = fs.readdirSync(publicDir);
  const htmlFiles = files.filter((f) => f.endsWith('.html'));
  writefile(outputFile, JSON.stringify(htmlFiles, null, 2));
  console.log(`Found ${htmlFiles.length} HTML files. List written to html-files.json.`);
}

function HtmlListPlugin() {
  return {
    name: 'generate-html-list',
    configureServer() {
      writeHtmlList();
    },
    buildStart() {
      writeHtmlList();
    }
  };
}

export default HtmlListPlugin;
