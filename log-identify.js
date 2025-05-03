import { readFile } from 'fs/promises';
import { defaultLogFilePath } from './src/utils.js';

const log = await readFile(defaultLogFilePath, 'utf-8');
const lines = log.split('\n').filter(Boolean);

let lastIndex = null;
let hasMissing = false;

lines.forEach((line, i) => {
  const match = line.match(/"rowIndex":(\d+)/);
  if (match) {
    const rowIndex = parseInt(match[1], 10);
    if (lastIndex !== null && rowIndex !== lastIndex + 1) {
      console.log(`⚠️  Missing rowIndex between ${lastIndex} and ${rowIndex} (at line ${i + 1})`);
      hasMissing = true;
    }
    lastIndex = rowIndex;
  }
});

if (!hasMissing) {
  console.log('✅ All rowIndex values are in order with nothing missing.');
}
