import ExcelJS from 'exceljs';
import * as glob from 'glob';
import moment from 'moment';
import path from 'path';
import { fileURLToPath } from 'url';
import { fixData, getDataRange } from './xlsx-helper.js';

const __filename = fileURLToPath(import.meta.url);

/**
 * Reads Excel (.xlsx) files from the .cache/sheets directory and extracts data starting from row 7488 (header row).
 *
 * @returns {Promise<import('../globals').ExcelRowData4[]>} - A promise that resolves to an array of parsed Excel row objects.
 */
export async function fetchXlsxData4() {
  const xlsxFile = (
    await glob.glob('**/*.xlsx', {
      cwd: path.join(process.cwd(), '.cache', 'sheets'),
      absolute: true
    })
  )[0];

  if (!xlsxFile) {
    throw new Error('No Excel files found in .cache/sheets directory');
  }

  // Read and parse the xlsx file using streaming reader
  const workbookReader = new ExcelJS.stream.xlsx.WorkbookReader(xlsxFile);
  const jsonData = [];
  let headers = [];

  for await (const worksheetReader of workbookReader) {
    let rowNumber = 0;

    for await (const row of worksheetReader) {
      rowNumber++;

      if (rowNumber === 7488) {
        // Row 7488 contains the actual headers
        const allHeaders = row.values.slice(1); // slice(1) to remove the first empty element

        // Use only the second set of headers (cleaner ones)
        // Headers: TANGGAL ENTRY, NAMA, NIK, TGL LAHIR, ALAMAT, BB, TB, PETUGAS ENTRY
        headers = allHeaders.slice(9, 17); // Take only the second set

        // console.log(`Found headers at row ${rowNumber}:`, headers);
        continue;
      }

      // Skip rows before 7488 and the header row itself
      if (rowNumber <= 7488) {
        continue;
      }

      // Process data rows (starting from 7489)
      const rowData = {};
      const allValues = row.values.slice(1); // slice(1) to remove the first empty element

      // Use only the second set of data columns (matching the headers we're using)
      const values = allValues.slice(9, 17); // Take only the second set of data

      // Skip empty rows
      if (!values || values.length === 0 || values.every((v) => v === undefined || v === null || v === '')) {
        continue;
      }

      values.forEach((value, index) => {
        const header = headers[index];
        if (header && value !== undefined && value !== null && value !== '') {
          // Convert Excel serial date numbers to proper date strings for TGL LAHIR
          if (header === 'TGL LAHIR' && typeof value === 'number') {
            // Excel serial date starts from January 1, 1900, but Excel incorrectly treats 1900 as a leap year
            const baseDate = moment('1900-01-01');
            const daysSinceBase = value - 1; // Subtract 1 because Excel serial date 1 = January 1, 1900

            // Account for Excel's leap year bug (Excel thinks 1900 is a leap year but it's not)
            const adjustedDays = daysSinceBase > 59 ? daysSinceBase - 1 : daysSinceBase;

            const resultDate = baseDate.clone().add(adjustedDays, 'days');
            rowData[header] = resultDate.format('DD/MM/YYYY');
          } else {
            rowData[header] = value;
          }
        }
      });

      // Only add row if it has meaningful data
      if (Object.keys(rowData).length > 0) {
        // Add the actual row number for reference
        rowData.originalRowNumber = rowNumber;
        jsonData.push(rowData);
      }
    }

    // Only process the first worksheet
    break;
  }

  return jsonData;
}

if (process.argv[1] === __filename) {
  (async () => {
    try {
      const outputFile = path.join(process.cwd(), 'tmp', 'range-data-output.json');

      const rangeData = await getDataRange(await fetchXlsxData4(), {
        fromNik: '3578106311200003',
        fromNama: 'NI NYOMAN ANINDYA MAHESWARI',
        toNik: '3578101502250001',
        toNama: 'MUHAMMAD NATHAN ALFATIR',
        outputFile
      });

      console.log(`\nSuccessfully extracted ${rangeData.length} rows`);

      const matches = [
        { index: 0, 'TGL LAHIR': '23/11/2020', NAMA: 'NI NYOMAN ANINDYA MAHESWARI', NIK: '3578106311200003' },
        {
          index: 10,
          'TGL LAHIR': moment('2022-05-10', 'YYYY-MM-DD').format('DD/MM/YYYY'),
          NAMA: 'SADDAM AQSABYAN',
          NIK: '3578101005220004'
        }
      ];

      for (let i = 0; i < rangeData.length; i++) {
        const data = rangeData[i];
        const actualData = matches.find((m) => m.index === i);
        if (actualData) {
          // console.log(`Row ${i} matches:`, match);
          const get = await fixData(data);
          console.log(
            `TGL LAHIR (fixed): ${get['TGL LAHIR']} | Expected: ${actualData['TGL LAHIR']} | Match: ${get['TGL LAHIR'] === actualData['TGL LAHIR']}`
          );
        }
      }

      // const fix = await fixData(rangeData.at(0));
      // const actualDate = moment('2022-05-10', 'YYYY-MM-DD').format('DD/MM/YYYY');
      // console.log(`\nFixed data:`, fix);
    } catch (error) {
      console.error(error);
    }
  })();
}
