import fs from 'fs';
import path from 'path';
import { defaultLogFilePath } from './src/utils.js';

// Path output
const outputPath = path.join(process.cwd(), '.cache/extracted.log');

// Baca file log
const content = fs.readFileSync(defaultLogFilePath, 'utf-8');

// Pisahkan baris-baris log
const lines = content.trim().split('\n');

// Filter baris untuk tanggal bulan April (04)
const aprilLines = lines.filter((line) => {
  const match = line.match(/({.*})$/);
  if (!match) return false;
  try {
    const data = JSON.parse(match[1]);
    const [_day, month, _year] = data.tanggal.split('/');
    return month === '04';
  } catch {
    return false;
  }
});

// Tulis hasil ke file baru
fs.writeFileSync(outputPath, aprilLines.join('\n'), 'utf-8');

console.log(`Extracted ${aprilLines.length} lines to ${outputPath}`);
