import fs from 'fs';
import path from 'path';

function writeHtmlList() {
  const publicDir = path.join(process.cwd(), 'public');
  const outputFile = path.join(publicDir, '/assets/data/html-files.json');
  const files = fs.readdirSync(publicDir);
  const htmlFiles = files.filter((f) => f.endsWith('.html') && f !== '404.html');
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(htmlFiles, null, 2));
  console.log(`Found ${htmlFiles.length} HTML files.\n\tList written to ${outputFile}.`);
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
