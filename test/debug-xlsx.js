import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SHEETS_DIR = path.join(__dirname, '..', '.cache', 'sheets');
const tmpDir = path.join(__dirname, '..', 'tmp');

// Ensure tmp directory exists
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

console.log('🔍 XLSX File Debugging Script');
console.log('============================');

// Check if sheets directory exists
console.log(`\n1. Checking sheets directory: ${SHEETS_DIR}`);
console.log(`   Directory exists: ${fs.existsSync(SHEETS_DIR)}`);

if (fs.existsSync(SHEETS_DIR)) {
  const allFiles = fs.readdirSync(SHEETS_DIR);
  console.log(`   Total files: ${allFiles.length}`);
  console.log(`   All files: ${JSON.stringify(allFiles, null, 2)}`);

  const xlsxFiles = allFiles.filter(file => file.endsWith('.xlsx'));
  console.log(`   XLSX files: ${xlsxFiles.length}`);

  // Check the specific file mentioned
  const targetFile = 'spreadsheet-1pPlAh4-Z_HLPvhjAljsNgQfYs9jrS3AnFzfPoOMZ-4c.xlsx';
  const targetPath = path.join(SHEETS_DIR, targetFile);

  console.log(`\n2. Checking target file: ${targetFile}`);
  console.log(`   Full path: ${targetPath}`);
  console.log(`   File exists: ${fs.existsSync(targetPath)}`);

  if (fs.existsSync(targetPath)) {
    const stats = fs.statSync(targetPath);
    console.log(`   File size: ${stats.size} bytes (${Math.round(stats.size / 1024)}KB)`);
    console.log(`   Modified: ${stats.mtime}`);

    try {
      console.log(`\n3. Testing XLSX reading:`);
      const workbook = XLSX.readFile(targetPath);
      console.log(`   Successfully read workbook`);
      console.log(`   Sheet names: ${JSON.stringify(workbook.SheetNames)}`);

      // Test each sheet
      workbook.SheetNames.forEach((sheetName, index) => {
        console.log(`\n   Sheet ${index + 1}: "${sheetName}"`);
        const worksheet = workbook.Sheets[sheetName];

        // Get range info
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
        console.log(`     Range: ${worksheet['!ref'] || 'No range'}`);
        console.log(`     Rows: ${range.e.r - range.s.r + 1}`);
        console.log(`     Cols: ${range.e.c - range.s.c + 1}`);

        // Convert to JSON to check data
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        console.log(`     Data rows: ${jsonData.length}`);

        // Convert to HTML to check rendering
        const htmlTable = XLSX.utils.sheet_to_html(worksheet, {
          id: `sheet-${sheetName}`,
          editable: false
        });
        console.log(`     HTML length: ${htmlTable.length} characters`);
        console.log(`     HTML preview: ${htmlTable.substring(0, 200)}...`);
      });

    } catch (error) {
      console.error(`   Error reading XLSX: ${error.message}`);
      console.error(`   Stack: ${error.stack}`);
    }
  } else {
    console.log(`\n   Available XLSX files:`);
    xlsxFiles.forEach(file => {
      console.log(`     - ${file}`);
    });
  }
}

// Save debug info to tmp directory
const debugInfo = {
  timestamp: new Date().toISOString(),
  sheetsDir: SHEETS_DIR,
  dirExists: fs.existsSync(SHEETS_DIR),
  files: fs.existsSync(SHEETS_DIR) ? fs.readdirSync(SHEETS_DIR) : [],
  targetFile: 'spreadsheet-1pPlAh4-Z_HLPvhjAljsNgQfYs9jrS3AnFzfPoOMZ-4c.xlsx',
  targetExists: fs.existsSync(path.join(SHEETS_DIR, 'spreadsheet-1pPlAh4-Z_HLPvhjAljsNgQfYs9jrS3AnFzfPoOMZ-4c.xlsx'))
};

const debugPath = path.join(tmpDir, 'xlsx-debug.json');
fs.writeFileSync(debugPath, JSON.stringify(debugInfo, null, 2));
console.log(`\n📝 Debug info saved to: ${debugPath}`);

console.log('\n✅ Debug script completed');
