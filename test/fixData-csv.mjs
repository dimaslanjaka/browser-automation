import Promise from 'bluebird';
import { loadCsvData } from '../data/index.js';
import { fixData } from '../src/xlsx-helper.js';

loadCsvData().then((datas) =>
  Promise.each(datas, async (data) => {
    try {
      return await fixData(data, { useCache: false, autofillTanggalEntry: true });
    } catch (err) {
      // Suppress invalid NIK length and missing NIK/NAMA errors and continue processing
      if (
        err &&
        err.message &&
        (err.message.includes('Invalid NIK length') || err.message.includes('NIK and NAMA are required'))
      ) {
        console.warn('[fixData-csv] Skipping row due to invalid or missing NIK/NAMA:', data.nik || data.NIK);
        return null;
      }
      // Re-throw other errors
      throw err;
    }
  })
);
