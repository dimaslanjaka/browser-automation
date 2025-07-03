import fs from "fs";
import * as glob from "glob";
import path from "path";
import { fileURLToPath } from "url";
import XLSX from "xlsx";

// Get __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define base search directory
const searchDir = path.join(__dirname, ".cache", "sheets");

// Use glob with { cwd }
const xlsxFiles = glob.sync("**/*.xlsx", { cwd: searchDir, absolute: true });

console.log(`Found ${xlsxFiles.length} XLSX files.`);

// Create output directories (using tmp for consistency with project standards)
const outputDir = path.join(__dirname, "tmp");
const tmpDir = path.join(__dirname, "tmp");
fs.mkdirSync(outputDir, { recursive: true });

// Track conversion results
const results = {
  success: 0,
  errors: 0,
  details: []
};

for (const filePath of xlsxFiles) {
  try {
    console.log(`Processing: ${filePath}`);

    // Check file size and provide appropriate warnings
    const stats = fs.statSync(filePath);
    const fileSizeKB = Math.round(stats.size / 1024);
    const fileSizeMB = Math.round(fileSizeKB / 1024 * 10) / 10;

    if (fileSizeMB > 1) {
      console.log(`File size: ${fileSizeMB}MB`);
    } else {
      console.log(`File size: ${fileSizeKB}KB`);
    }

    if (fileSizeKB > 10000) { // Warn for files larger than 10MB
      console.log(`⚠️  Large file detected (${fileSizeMB}MB) - this may take a while...`);
    }

    const workbook = XLSX.readFile(filePath);
    console.log(`Sheet names: ${JSON.stringify(workbook.SheetNames)}`);

    if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
      console.error(`❌ No sheets found in ${filePath}`);
      continue;
    }

    const sheetName = workbook.SheetNames[0];
    console.log(`Using sheet: ${sheetName}`);

    if (!workbook.Sheets[sheetName]) {
      console.error(`❌ Sheet "${sheetName}" not found in ${filePath}`);
      continue;
    }

    const worksheet = workbook.Sheets[sheetName];

    // Check if worksheet has any data
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    const hasData = range.e.r > 0 || range.e.c > 0;

    if (!hasData) {
      console.log(`⚠️  Sheet "${sheetName}" appears to be empty in ${filePath}`);
    }

    console.log(`Converting sheet to HTML...`);
    const htmlTable = XLSX.utils.sheet_to_html(worksheet);

    const baseName = path.basename(filePath, path.extname(filePath));
    const outputFilePath = path.join(outputDir, `${baseName}.html`);

    const fullHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${baseName}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
  </style>
</head>
<body>
  <h1>${baseName}</h1>
  ${htmlTable}
</body>
</html>
`;

    fs.writeFileSync(outputFilePath, fullHtml, "utf8");
    console.log(`✅ ${filePath} → ${outputFilePath}`);

    results.success++;
    results.details.push({ file: baseName, status: 'success', output: outputFilePath });

  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error.message);
    console.error(`   Stack: ${error.stack}`);

    results.errors++;
    results.details.push({
      file: path.basename(filePath),
      status: 'error',
      error: error.message
    });
  }
}

// Write summary to tmp directory
const summaryPath = path.join(tmpDir, 'xlsx-to-html-results.json');
fs.writeFileSync(summaryPath, JSON.stringify(results, null, 2));

console.log(`\n📊 Conversion Summary:`);
console.log(`   ✅ Success: ${results.success}`);
console.log(`   ❌ Errors: ${results.errors}`);
console.log(`   📄 Results saved to: ${summaryPath}`);

if (results.errors > 0) {
  console.log(`\n❌ Files with errors:`);
  results.details
    .filter(d => d.status === 'error')
    .forEach(d => console.log(`   • ${d.file}: ${d.error}`));
}
