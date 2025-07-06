// MAIN SCRIPT
import moment from 'moment';
import { fetchXlsxData4 } from '../src/fetchXlsxData4.js';
import { fixData } from '../src/xlsx-helper.js';

(async () => {
  const rows = await fetchXlsxData4();
  // const _result = await fixData(rows[0]);
  // console.log('Result:', _result);
  for (const row of rows) {
    const excludedNIKs = ['3578100000000001', '4360000000000658'];
    if (!row.NIK || excludedNIKs.includes(row.NIK)) {
      console.log('Skipping row with invalid or excluded NIK:', row);
      continue;
    }

    /** @type {Awaited<ReturnType<typeof fixData>>} */
    let _result;
    try {
      _result = await fixData(row);
    } catch (err) {
      console.log('Error in fixData for row:', JSON.stringify(row, null, 2));
      throw err;
    }

    // Single test
    if (!_result.nik !== '3578104211230003') continue; // Skip if NIK

    if (!_result.pekerjaan) {
      console.log('Row data:', JSON.stringify(row, null, 2));
      throw new Error(`Pekerjaan not found for NIK: ${_result.nik}`);
    }
    // validate date format for row.['TGL LAHIR'] and row.parsed_nik.lahir DD/MM/YYYY
    const tglLahir = row['TGL LAHIR'];
    const parsedNikLahir = row.parsed_nik?.lahir;

    if (!moment(tglLahir, 'DD/MM/YYYY', true).isValid()) {
      console.log('Row data:', JSON.stringify(row, null, 2));
      throw new Error(`Invalid date format for TGL LAHIR: '${tglLahir}' (NIK: ${_result.nik})`);
    }
    if (!tglLahir) {
      if (parsedNikLahir && !moment(parsedNikLahir, 'DD/MM/YYYY', true).isValid()) {
        console.log('Row data:', JSON.stringify(row, null, 2));
        throw new Error(`Invalid date format for parsed_nik.lahir: '${parsedNikLahir}' (NIK: ${_result.nik})`);
      }
    }
  }
})();
