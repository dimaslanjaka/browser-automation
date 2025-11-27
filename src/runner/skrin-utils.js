import path from 'path';
import fs from 'fs';
import xlsx from 'xlsx';
import { logLine } from '../utils.js';

/**
 * Parse baby name from entry string
 *
 * Extracts baby name from various formats:
 * - "Mother Name, BY (Baby Name)" format or "Mother Name, BY" at the end
 * - "/Baby Name" format at the end (returns mother name if baby name is "BAYI")
 * - "(Baby Name)" parenthesized format
 *
 * @param {string} entry - The entry string containing baby name information
 * @returns {string|undefined} Extracted baby name or undefined if no match found
 */
export function parseBabyName(entry) {
  let result = undefined;

  // Match "Baby Name / Mother Name, BY" format first (has priority over simple "Mother Name, BY")
  let match = entry.match(/\/\s*(.+?),\s*(BY|AN)(?:\s*\((.+))?$/i);
  if (match) {
    result = match[1].trim();
    return result; // Return early
  }

  // Match "Mother Name, BY (Baby Name)" or "Mother Name, BY" at the end
  match = entry.match(/^([^,]+),\s*(BY|AN)(?:\s*\((.+))?$/i);
  if (match) {
    result = match[1].trim();
    return result; // Return early to avoid being overwritten by parentheses match
  }

  match = entry.match(/\/\s*([A-Z].+)$/i);
  if (match) {
    const extractedPart = match[1].replace(/[,)]\s*$/g, '').trim();
    // If the extracted part is just "BAYI" or starts with "BY/AN", return the part before the slash
    if (/^bayi$/i.test(extractedPart) || /^(by|an)\s/i.test(extractedPart)) {
      result = entry.replace(/\s*\/\s*(.+)$/i, '').trim();
    } else {
      result = extractedPart;
    }
    return result; // Return early to avoid being overwritten by parentheses match
  }

  match = entry.match(/\(([^)]+)\)/);
  if (match) result = match[1].trim();

  return result;
}

/**
 * Load and parse Excel file from the cache directory
 *
 * @async
 * @param {string} filename - The Excel filename (e.g., 'spreadsheet-1pPlAh4-Z_HLPvhjAljsNgQfYs9jrS3AnFzfPoOMZ-4c.xlsx')
 * @param {string} sheetName - The sheet name to read from the workbook
 * @param {Object} [options] - Optional configuration
 * @param {boolean} [options.hasHeaders=true] - Whether the sheet has headers in the first row
 * @returns {Promise<Array<Object|Array>>} Array of row objects (if hasHeaders) or array of arrays (if no headers)
 * @throws {Error} If file not found, sheet not found, or read operation fails
 */
export async function loadExcelSheet(filename, sheetName, options = {}) {
  const { hasHeaders = true } = options;

  try {
    // Path to the Excel file
    const excelPath = path.join(process.cwd(), '.cache', 'sheets', filename);

    logLine(`Loading Excel file: ${excelPath}`);
    logLine(`Target sheet: ${sheetName}`);
    logLine(`Has headers: ${hasHeaders}`);

    // Check if file exists
    if (!fs.existsSync(excelPath)) {
      throw new Error(`Excel file not found: ${excelPath}`);
    }

    // Read the workbook
    const workbook = xlsx.readFile(excelPath);

    // Check if sheet exists
    if (!workbook.SheetNames.includes(sheetName)) {
      const availableSheets = workbook.SheetNames.join(', ');
      throw new Error(`Sheet '${sheetName}' not found. Available sheets: ${availableSheets}`);
    }

    // Get the worksheet
    const worksheet = workbook.Sheets[sheetName];

    // Convert sheet to JSON or array based on hasHeaders flag
    let data;
    if (hasHeaders) {
      data = xlsx.utils.sheet_to_json(worksheet, {
        raw: false,
        cellDates: true,
        dateNF: 'DD/MM/YYYY'
      });
      logLine(`Column headers: ${Object.keys(data[0] || {}).join(', ')}`);
    } else {
      // Read as array of arrays without treating first row as headers
      data = xlsx.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: false,
        cellDates: true,
        dateNF: 'DD/MM/YYYY'
      });
    }

    logLine(`Successfully loaded ${data.length} rows from sheet '${sheetName}'`);

    return data;
  } catch (error) {
    console.error('Error loading Excel file:', error.message);
    throw error;
  }
}
