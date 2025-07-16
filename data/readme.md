

# CSV Data Loader (`data/index.js`)

This module parses and normalizes CSV data from `data.csv`, mapping various column names to standardized keys and formatting dates for consistency.

## Features

- **ESM Syntax**: Uses modern Node.js ESM imports.
- **Streaming CSV Parsing**: Utilizes [`csv-parser`](https://www.npmjs.com/package/csv-parser) for efficient row-by-row parsing.
- **Column Normalization**: Maps multiple possible column names to standardized keys via a `keyMap` (e.g., `NAMA PASIEN` and `NAMA` → `nama`).
- **Row Indexing**: Adds a `rowIndex` property to each row for easy reference.
- **Date Formatting**: Normalizes date fields (like `tgl_lahir`) to `DD/MM/YYYY` using [`moment`](https://momentjs.com/), while preserving the original value as `originalTglLahir`.
- **Data Export**: Writes the normalized data to `public/assets/data/dataKunto.json` for debugging or further use.
- **TypeScript Support**: Output is typed as `ExcelRowData4[]` (see `globals.d.ts`).

## Usage

```js
import { loadCsvData } from './data/index.js';

const dataKunto = await loadCsvData();
console.log(dataKunto[0]); // First row
```

## Output Example

Each row is an object with standardized keys:

```js
{
  tanggal: 'BULAN JUNI',
  nama: 'AZKAGALE SUJARWO',
  nik: '35**********01',
  pekerjaan: 'BELUM/TIDAK BEKERJA',
  bb: '14,6',
  tb: '98,5',
  alamat: 'TSONOREJO 20',
  tgl_lahir: '29/08/2021', // formatted as DD/MM/YYYY
  petugas: 'KUNTO',
  rowIndex: 0,
  originalTglLahir: '2021-08-29' // original value
}
```

## Notes

- Update `keyMap` in `data/index.js` to support new or changed column names.
- For debugging, you can uncomment the `console.log` lines in the source to inspect the first and last records.
- The loader writes the normalized data to `public/assets/data/dataKunto.json` on each run.
