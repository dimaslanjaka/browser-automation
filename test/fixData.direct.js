// MAIN SCRIPT
import moment from 'moment';
import { loadCsvData } from '../data/index.js';
import { fetchXlsxData4 } from '../src/fetchXlsxData4.js';
import fixData, { isValidNik } from '../src/utils/xlsx/fixData.js';
import Bluebird from 'bluebird';

export async function runFixDataDirect() {
  const rows = await fetchXlsxData4();
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

    const bb = _result.bb || _result.BB || null;
    const tb = _result.tb || _result.TB || null;
    if (!bb || !tb) {
      console.log('Row data:', JSON.stringify(row, null, 2));
      throw new Error(`Berat badan or tinggi badan not found for NIK: ${_result.nik}`);
    }
  }
}

export async function findDataTanggalEntryNonCurrentMonth() {
  const loaded = await loadCsvData();
  // Preserve original TANGGAL ENTRY value for comparison after processing
  loaded.forEach((r) => {
    r.__origTanggal = (r['TANGGAL ENTRY'] || r.tanggal || '').toString().trim().toUpperCase();
  });

  // Immediately filter to rows that are valid NIK
  // This ensures non-MARET rows are removed before calling `fixData`.
  const rows = loaded.filter((row) => {
    const raw = row.NIK || row.nik;
    if (!isValidNik(raw)) return false;
    return true;
  });

  const data = await Bluebird.map(
    rows,
    (row) => fixData(row, { autofillTanggalEntry: true, fixNamaBayi: true, useCache: true }),
    {
      concurrency: 10
    }
  );

  // After processing, print rows whose original TANGGAL ENTRY was 'MARET'
  // but the resolved date is not in March (or is invalid)
  const mismatches = data.filter((item) => {
    if (!item) return false;
    const orig = (item.__origTanggal || '').toString().trim().toUpperCase();
    if (orig !== 'MARET') return false;
    const finalTanggal = (item['TANGGAL ENTRY'] || item.tanggal || '').toString().trim();
    const m = moment(finalTanggal, 'DD/MM/YYYY', true);
    if (!m.isValid()) return true;
    return m.month() !== 2; // month() is 0-indexed: 2 => March
  });
  if (mismatches.length) {
    const r = mismatches[0];
    console.log('First mismatch found:', {
      rowIndex: r.rowIndex,
      nik: r.NIK || r.nik,
      nama: r.NAMA || r.nama,
      orig: r.__origTanggal,
      final: r['TANGGAL ENTRY'] || r.tanggal
    });
  }
}

findDataTanggalEntryNonCurrentMonth().catch(console.error);
