import csv from 'csv-parser';
import dotenv from 'dotenv';
import * as glob from 'glob';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'url';

// Get the absolute path of the current script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

/**
 * @typedef {Record<string, any> & { rowIndex: number }} CsvRow
 */

/**
 * @param {number} startIndex
 * @param {number} lastIndex
 * @returns {Promise<CsvRow[]>}
 */
export async function getCsvData(startIndex = 0, lastIndex = Number.MAX_SAFE_INTEGER) {
  const csvFiles = await glob.glob('.cache/sheets/*.csv', {
    cwd: process.cwd(),
    absolute: true
  });

  /** @type {CsvRow[]} */
  const allData = [];
  let currentIndex = 0;

  for (const file of csvFiles) {
    const fileData = await new Promise((resolve, reject) => {
      /** @type {CsvRow[]} */
      const rows = [];
      fs.createReadStream(file)
        .pipe(csv())
        .on('data', (data) => {
          /** @type {CsvRow} */
          const row = { ...data, rowIndex: currentIndex++ };
          rows.push(row);
        })
        .on('end', () => resolve(rows))
        .on('error', reject);
    });

    allData.push(...fileData);
  }

  return allData.slice(startIndex, lastIndex + 1);
}

if (process.argv[1] === __filename) {
  (async () => {
    const datas = await getCsvData();
    let lastItem = datas.at(-1);
    let firstItem = datas.at(0);
    console.log('total data:', datas.length);
    console.log('first data:', firstItem);
    console.log('last data:', lastItem);
  })();
}
