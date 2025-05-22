import fs from 'fs';
import { defaultLogFilePath } from './src/utils.js';

const log = fs.readFileSync(defaultLogFilePath, 'utf-8');
const lines = log.split('\n').filter(Boolean);

let lastIndex = null;
let hasMissing = false;
const seenRowIndexes = new Set();

lines.forEach((line, i) => {
  if (`${line.trim()}`.length === 0) {
    // Skip empty lines
    return;
  }
  const match = line.match(/"rowIndex":(\d+)/);
  if (match) {
    const rowIndex = parseInt(match[1], 10);

    if (seenRowIndexes.has(rowIndex)) {
      console.log(`⚠️  Duplicated rowIndex ${rowIndex} (at line ${i + 1})`);
      return; // Skip missing check for duplicates
    }

    seenRowIndexes.add(rowIndex);

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
