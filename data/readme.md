
# data/index.js

Parses and normalizes CSV data from `data.csv` with standardized keys and date formatting.

## Features

- Reads `data.csv` using Node.js ESM syntax.
- Uses [`csv-parser`](https://www.npmjs.com/package/csv-parser) for streaming CSV parsing.
- Maps various column names to standardized keys using a `keyMap` object (e.g., `NAMA PASIEN` and `NAMA` both become `nama`).
- Adds a `rowIndex` property to each row for easy reference.
- Normalizes date fields (e.g., `tgl_lahir`) to `DD/MM/YYYY` format using [`moment`](https://momentjs.com/).
- Exports a function `loadCsvData()` that returns the normalized data as an array of objects.
- Writes the normalized data to `tmp/dataKunto.json` for debugging or further processing.

## Usage

Import and use the async loader:

```js
import { loadCsvData } from './data/index.js';

const dataKunto = await loadCsvData();
console.log(dataKunto[0]); // First row
```

## TypeScript

The parsed data is typed as `ExcelRowData4[]` (see `globals.d.ts`).

## Example Output

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

- Update `keyMap` to support new or changed column names.
- For debugging, you can uncomment the provided `console.log` lines in the source to inspect the first and last records.
- The loader writes the normalized data to `tmp/dataKunto.json` on each run.
