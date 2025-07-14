import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logLine } from '../src/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function AfterBuildCopyPlugin() {
  return {
    name: 'after-build-copy-index',
    closeBundle() {
      const distDir = path.join(__dirname, '../dist');
      const src = path.join(distDir, 'index.html');
      const dests = [path.join(distDir, 'nik-parser/index.html')];
      for (const dest of dests) {
        if (!fs.existsSync(path.dirname(dest))) {
          fs.mkdirSync(path.dirname(dest), { recursive: true });
        }
        fs.copyFileSync(src, dest);
        logLine(`Copied ${src} to ${dest}`);
      }
    }
  };
}

export default AfterBuildCopyPlugin;
