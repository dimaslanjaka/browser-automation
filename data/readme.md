# data/index.js

This module parses and normalizes CSV data from `data.csv`.

## Features
- Reads `data.csv` using Node.js ESM syntax.
- Uses `csv-parse/sync` for robust CSV parsing.
- Maps various column names to standardized keys using a `keyMap` object (e.g., `NAMA PASIEN` and `NAMA` both become `nama`).
- Removes original keys after mapping to avoid duplicates.
- Adds a `rowIndex` property to each row for easy reference.
- Exports the normalized data as `dataKunto`.

## Usage
Import `dataKunto` to access the parsed and mapped data:
```js
import { dataKunto } from './data/index.js';
```

## TypeScript
The parsed data is typed as `ExcelRowData4[]` (see `globals.d.ts`).

## Example Output
Each row is an object with standardized keys.
```js
{
  tanggal: 'BULAN JUNI',
  nama: 'AZKAGALE SUJARWO',
  nik: '35**********01',
  pekerjaan: 'BELUM/TIDAK BEKERJA',
  bb: '14,6',
  tb: '98,5',
  alamat: 'TSONOREJO 20',
  tgl_lahir: '2021-08-29',
  petugas: 'KUNTO',
  rowIndex: 0
}
```

## Notes
- Update `keyMap` to support new or changed column names.
- For debugging, you can uncomment the provided `console.log` lines to inspect the first and last records.
