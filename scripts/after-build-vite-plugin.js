import fs from 'fs';
import path from 'path';
import { logLine } from '../src/utils.js';

function AfterBuildCopyPlugin() {
  let isBuild = false;
  return {
    name: 'after-build-copy-index',
    configResolved(config) {
      isBuild = config.command === 'build';
    },
    closeBundle() {
      if (!isBuild) return;
      const distDir = path.join(process.cwd(), 'dist');
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
