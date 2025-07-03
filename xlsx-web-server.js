import express from 'express';
import fs from 'fs';
import nunjucks from 'nunjucks';
import path from 'path';
import { fileURLToPath } from 'url';
import XLSX from 'xlsx';

// ESM-friendly __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Configure Nunjucks
const templatesDir = path.join(__dirname, 'templates');
const env = nunjucks.configure(templatesDir, {
  autoescape: true,
  express: app,
  watch: true // Enable template reloading in development
});

// Add custom filters
env.addFilter('number', function(num) {
  if (typeof num !== 'number') {
    return num;
  }
  return num.toLocaleString();
});

// Serve static files (CSS, JS, etc.)
app.use('/static', express.static(path.join(__dirname, 'public')));

// Serve static files directly from public folder (for favicon, images, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Handle favicon.ico to prevent 404 errors if not found in public folder
app.get('/favicon.ico', (req, res) => {
  res.status(204).end(); // No Content
});

// XLSX files directory
const SHEETS_DIR = path.join(__dirname, '.cache', 'sheets');

// Main route - list all XLSX files
app.get('/', (req, res) => {
  try {
    console.log(`[DEBUG] Checking sheets directory: ${SHEETS_DIR}`);
    console.log(`[DEBUG] Directory exists: ${fs.existsSync(SHEETS_DIR)}`);

    if (!fs.existsSync(SHEETS_DIR)) {
      console.log(`[ERROR] Sheets directory not found: ${SHEETS_DIR}`);
      return res.render('error.njk', {
        errorTitle: 'Sheets Directory Not Found',
        errorMessage: 'No sheets directory found.',
        suggestions: [
          'Run "node google-sheet-api.js" to download sheets',
          'Check that the .cache/sheets directory exists'
        ]
      });
    }

    const allFiles = fs.readdirSync(SHEETS_DIR);
    console.log(`[DEBUG] All files in directory: ${JSON.stringify(allFiles)}`);

    const files = allFiles
      .filter(file => file.endsWith('.xlsx'))
      .map(file => ({
        name: file,
        path: `/view/${encodeURIComponent(file)}`,
        sizeKB: Math.round(fs.statSync(path.join(SHEETS_DIR, file)).size / 1024)
      }));

    console.log(`[DEBUG] XLSX files found: ${files.length}`);
    files.forEach(file => {
      console.log(`[DEBUG] File: ${file.name}, Size: ${file.sizeKB}KB, Path: ${file.path}`);
    });

    res.render('file-list.njk', { files });
  } catch (error) {
    console.error(`[ERROR] Error listing files: ${error.message}`);
    res.render('error.njk', {
      errorTitle: 'Server Error',
      errorMessage: error.message,
      suggestions: ['Check server logs for more details']
    });
  }
});

// View specific XLSX file
app.get('/view/:filename', (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = path.join(SHEETS_DIR, filename);

    // Get pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 100; // Default to 100 rows
    const maxLimit = 1000; // Maximum 1000 rows per page
    const actualLimit = Math.min(limit, maxLimit);

    console.log(`[DEBUG] Requested filename: ${filename}`);
    console.log(`[DEBUG] Full file path: ${filePath}`);
    console.log(`[DEBUG] File exists: ${fs.existsSync(filePath)}`);
    console.log(`[DEBUG] Pagination - Page: ${page}, Limit: ${actualLimit}`);

    if (!fs.existsSync(filePath)) {
      console.log(`[ERROR] File not found: ${filePath}`);
      return res.render('error.njk', {
        errorTitle: 'File Not Found',
        errorMessage: `The file "${filename}" was not found.`,
        suggestions: [
          'Check that the file name is correct',
          'Ensure the file exists in the .cache/sheets directory',
          'Go back to the file list to see available files'
        ]
      });
    }

    // Read the XLSX file
    console.log(`[DEBUG] Reading XLSX file: ${filePath}`);
    const workbook = XLSX.readFile(filePath);
    const sheetNames = workbook.SheetNames;
    console.log(`[DEBUG] Sheet names found: ${JSON.stringify(sheetNames)}`);

    // Convert sheets to HTML tables with pagination
    const sheets = sheetNames.map(sheetName => {
      console.log(`[DEBUG] Processing sheet: ${sheetName}`);
      const worksheet = workbook.Sheets[sheetName];

      // Get the full range and data info
      const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
      const totalRows = range.e.r - range.s.r + 1;
      const totalCols = range.e.c - range.s.c + 1;

      console.log(`[DEBUG] Sheet ${sheetName} - Total rows: ${totalRows}, cols: ${totalCols}`);

      // For large datasets, show only a subset
      let htmlTable;
      let isLimited = false;

      if (totalRows > actualLimit) {
        // Create a limited range
        const startRow = (page - 1) * actualLimit;
        const endRow = Math.min(startRow + actualLimit - 1, range.e.r);

        console.log(`[DEBUG] Limiting rows from ${startRow} to ${endRow}`);

        // Create new range for limited data
        const limitedRange = {
          s: { r: Math.max(0, startRow), c: range.s.c },
          e: { r: endRow, c: range.e.c }
        };

        // Extract limited data
        const limitedWorksheet = {};
        for (let row = limitedRange.s.r; row <= limitedRange.e.r; row++) {
          for (let col = limitedRange.s.c; col <= limitedRange.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
            if (worksheet[cellAddress]) {
              // Adjust row index for display
              const newCellAddress = XLSX.utils.encode_cell({
                r: row - limitedRange.s.r,
                c: col
              });
              limitedWorksheet[newCellAddress] = worksheet[cellAddress];
            }
          }
        }

        // Set the range for the limited worksheet
        limitedWorksheet['!ref'] = XLSX.utils.encode_range({
          s: { r: 0, c: range.s.c },
          e: { r: limitedRange.e.r - limitedRange.s.r, c: range.e.c }
        });

        htmlTable = XLSX.utils.sheet_to_html(limitedWorksheet, {
          id: `sheet-${sheetName}`,
          editable: false
        });

        isLimited = true;
      } else {
        htmlTable = XLSX.utils.sheet_to_html(worksheet, {
          id: `sheet-${sheetName}`,
          editable: false
        });
      }

      console.log(`[DEBUG] Generated HTML table for ${sheetName}, length: ${htmlTable.length}, limited: ${isLimited}`);

      return {
        name: sheetName,
        htmlTable: htmlTable,
        totalRows: totalRows,
        isLimited: isLimited,
        currentPage: page,
        limit: actualLimit,
        totalPages: Math.ceil(totalRows / actualLimit)
      };
    });

    console.log(`[DEBUG] Rendering template with ${sheets.length} sheets`);

    // Calculate max total pages from all sheets for global pagination
    const maxTotalPages = Math.max(...sheets.map(s => s.totalPages));

    res.render('xlsx-viewer.njk', {
      filename,
      sheetNames,
      sheets,
      pagination: {
        currentPage: page,
        limit: actualLimit,
        totalPages: maxTotalPages,
        hasLargeData: sheets.some(s => s.isLimited)
      }
    });
  } catch (error) {
    console.error(`[ERROR] Error processing XLSX file: ${error.message}`);
    console.error(`[ERROR] Stack trace: ${error.stack}`);
    res.render('error.njk', {
      errorTitle: 'Error Reading XLSX File',
      errorMessage: error.message,
      suggestions: [
        'Check that the file is a valid XLSX format',
        'Ensure the file is not corrupted',
        'Try re-downloading the file'
      ]
    });
  }
});

// API endpoint to get sheet data as JSON - all sheets
app.get('/api/sheet/:filename', (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = path.join(SHEETS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const workbook = XLSX.readFile(filePath);

    // Return all sheets
    const allSheets = {};
    workbook.SheetNames.forEach(name => {
      const worksheet = workbook.Sheets[name];
      allSheets[name] = XLSX.utils.sheet_to_json(worksheet);
    });
    res.json({ sheets: workbook.SheetNames, data: allSheets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// API endpoint to get specific sheet data as JSON
app.get('/api/sheet/:filename/:sheetname', (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const sheetName = decodeURIComponent(req.params.sheetname);
    const filePath = path.join(SHEETS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const workbook = XLSX.readFile(filePath);

    // Return specific sheet
    if (!workbook.Sheets[sheetName]) {
      return res.status(404).json({ error: 'Sheet not found' });
    }

    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);
    res.json({ sheetName, data: jsonData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  // Ensure tmp directory exists for logging
  const tmpDir = path.join(__dirname, 'tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  console.log(`🚀 XLSX Web Server running at http://localhost:${PORT}`);
  console.log(`📁 Serving files from: ${SHEETS_DIR}`);
  console.log(`📝 Debug logs will be shown in console`);
  console.log('📊 Available endpoints:');
  console.log(`   • http://localhost:${PORT}/ - File list`);
  console.log(`   • http://localhost:${PORT}/view/filename.xlsx - View XLSX file`);
  console.log(`   • http://localhost:${PORT}/api/sheet/filename.xlsx - Get all sheets as JSON`);
  console.log(`   • http://localhost:${PORT}/api/sheet/filename.xlsx/SheetName - Get specific sheet as JSON`);
});

export default app;
