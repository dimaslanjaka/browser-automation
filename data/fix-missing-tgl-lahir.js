import ansiColors from 'ansi-colors';
import dotenv from 'dotenv';
import fs from 'fs-extra';
import nodeXlsx from 'node-xlsx';
import { writefile } from 'sbg-utility';
import path from 'upath';
import { fileURLToPath } from 'url';
import { loadCsvData } from './index.js';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env'), override: true, quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputFilePath = path.join(process.cwd(), 'data/data.csv');
const driveCsvFilePath = path.join(process.cwd(), 'data/drive.csv');
const localXlsxFilePath = path.join(process.cwd(), 'data/GADING.xlsx');

/**
 * Parse xlsx file and extract data
 * @param {string} filePath - Path to xlsx file
 * @returns {Array<Object>} Parsed data array
 */
function parseXlsxFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(ansiColors.red(`File not found: ${filePath}`));
    return [];
  }

  console.log(ansiColors.cyan(`Parsing xlsx file: ${filePath}`));

  const workSheetsFromFile = nodeXlsx.parse(filePath, {
    type: 'binary',
    cellDates: true,
    cellNF: false,
    cellText: false,
    dateNF: 'DD/MM/YYYY'
  });

  const allData = [];

  workSheetsFromFile.forEach((sheet, sheetIndex) => {
    console.log(ansiColors.gray(`  Sheet ${sheetIndex + 1}: ${sheet.name}`));

    // Get header row
    const headerRow = sheet.data[0] || [];
    console.log(ansiColors.gray(`  Headers: ${headerRow.join(', ')}`));

    // Process data rows (skip header)
    sheet.data.slice(1).forEach((row) => {
      if (!row || row.length === 0) return;

      const rowData = {};
      headerRow.forEach((header, colIndex) => {
        if (header) {
          let value = row[colIndex];

          // Handle date objects
          if (value instanceof Date) {
            const day = String(value.getDate()).padStart(2, '0');
            const month = String(value.getMonth() + 1).padStart(2, '0');
            const year = value.getFullYear();
            value = `${day}/${month}/${year}`;
          }

          rowData[header] = value;
        }
      });

      if (Object.keys(rowData).length > 0) {
        allData.push(rowData);
      }
    });
  });

  console.log(ansiColors.green(`Parsed ${allData.length} rows from ${workSheetsFromFile.length} sheet(s)`));
  return allData;
}

// Main execution
async function main() {
  console.log(ansiColors.bold.cyan('=== Fix Missing Tgl Lahir ==='));

  // Parse local xlsx file
  const xlsxData = parseXlsxFile(localXlsxFilePath);

  if (xlsxData.length === 0) {
    console.log(ansiColors.yellow('No data found in xlsx file'));
    return;
  }

  console.log(ansiColors.cyan(`\nSample data (first 5 rows):`));
  xlsxData.slice(0, 5).forEach((row, index) => {
    console.log(ansiColors.gray(`  Row ${index + 1}:`), row);
  });

  // Build NIK lookup map from XLSX data
  console.log(ansiColors.cyan('\nBuilding NIK lookup map from XLSX...'));
  const nikToXlsxDataMap = new Map();
  xlsxData.forEach((row) => {
    if (row.NIK) {
      nikToXlsxDataMap.set(String(row.NIK).trim(), {
        tglLahir: row['TANGGAL LAHIR'],
        noKk: row['NO KK'],
        umur: row.UMUR
      });
    }
  });
  console.log(ansiColors.green(`Created lookup map with ${nikToXlsxDataMap.size} NIK entries`));

  // Load drive CSV data
  console.log(ansiColors.cyan('\nLoading drive CSV data...'));
  const driveCsvData = await loadCsvData(driveCsvFilePath);
  console.log(ansiColors.green(`Loaded ${driveCsvData.length} rows from drive CSV`));

  // Match and enrich data
  console.log(ansiColors.cyan('\nMatching NIKs and enriching data...'));
  let matchCount = 0;
  let invalidNikCount = 0;
  let missingCount = 0;

  const enrichedData = driveCsvData.map((row) => {
    const nikKey = String(row.nik || '').trim();

    if (nikKey && nikToXlsxDataMap.has(nikKey)) {
      const xlsxInfo = nikToXlsxDataMap.get(nikKey);

      // Add or update TGL LAHIR field
      row.tgl_lahir = xlsxInfo.tglLahir;
      // Add NO KK and UMUR fields
      row.no_kk = xlsxInfo.noKk;
      row.umur = xlsxInfo.umur;

      matchCount++;
    } else {
      if (nikKey) {
        // NIK present but not found in lookup
        invalidNikCount++;
      } else {
        // MISSING NIK handler - implement here
        console.log(ansiColors.magenta(`Missing NIK: ${row.nama || 'unknown'}`));
      }
    }

    if (!row.tgl_lahir && nikKey && nikToXlsxDataMap.has(nikKey)) {
      missingCount++;
      console.log(ansiColors.magenta(`Missing tgl_lahir for NIK: ${nikKey}`));
    }

    return row;
  });

  console.log(ansiColors.green(`  Matched: ${matchCount}`));
  console.log(ansiColors.yellow(`  Invalid NIK: ${invalidNikCount}`));
  console.log(ansiColors.red(`  Missing Tgl Lahir: ${missingCount}`));
  console.log(ansiColors.gray(`  Total processed: ${enrichedData.length}`));

  // Write enriched data to output CSV
  console.log(ansiColors.cyan('\nWriting enriched data to output CSV...'));

  // Build CSV content
  // Use original drive.csv header format
  const csvHeaders = ['TANGGAL ENTRY', 'NIK', 'NAMA', 'ALAMAT', 'PETUGAS ENTRY', 'NO KK', 'UMUR', 'TANGGAL LAHIR'];
  const csvLines = [csvHeaders.join(',')];
  enrichedData.forEach((row) => {
    const values = csvHeaders.map((header) => {
      // Map internal keys to output headers
      const keyMap = {
        'TANGGAL ENTRY': 'tanggal',
        NIK: 'nik',
        NAMA: 'nama',
        ALAMAT: 'alamat',
        'PETUGAS ENTRY': 'petugas',
        'NO KK': 'no_kk',
        UMUR: 'umur',
        'TANGGAL LAHIR': 'tgl_lahir'
      };
      let value = row[keyMap[header]] === 0 || row[keyMap[header]] ? row[keyMap[header]] : '';

      // Ensure NIK is written as string (not scientific notation)
      if (header === 'NIK' && value) {
        // If it's a number, convert it to string without scientific notation
        if (!isNaN(value) && !value.includes('E') && !value.includes('e')) {
          value = String(BigInt(Math.floor(Number(value))));
        }
      }

      // Escape values containing commas or quotes
      if (String(value).includes(',') || String(value).includes('"') || String(value).includes('\n')) {
        return `"${String(value).replace(/"/g, '""')}"`;
      }
      return value;
    });
    csvLines.push(values.join(','));
  });

  const csvContent = csvLines.join('\n');
  writefile(outputFilePath, csvContent);

  console.log(ansiColors.green(`\nData saved to: ${outputFilePath}`));
  console.log(ansiColors.bold.green('\n✓ Process completed successfully!'));

  // Output debug JSON
  const outputJsonPath = path.join(process.cwd(), 'data/output.json');
  writefile(outputJsonPath, JSON.stringify(enrichedData.slice(0, 10), null, 2));
  console.log(ansiColors.gray(`Debug sample saved to: ${outputJsonPath}`));
}

main().catch(console.error);
