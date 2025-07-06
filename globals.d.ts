export interface ExcelRowData {
  rowIndex: number;
  tanggal: string;
  nama: string;
  nik: string; // Should be at least 16 characters
  pekerjaan: string;
  bb: number;
  tb: number;
  batuk: string;
  diabetes: string;
  alamat?: string;
  parsed_nik?: null | import('nik-parser-jurusid').NikParseResult;
}

export interface ExcelRowData4 {
  'TANGGAL ENTRY': string;
  'NAMA PASIEN': string;
  'NIK PASIEN': string;
  PEKERJAAN: string;
  BB: string | number;
  TB: number;
  ALAMAT: string;
  'TGL LAHIR': number | string; // Excel date serial number or formatted date
  'PETUGAS ENTRY': string;
  NAMA: string;
  NIK: string;
  originalRowNumber: number;
}

export type fixDataResult = ExcelRowData4 &
  ExcelRowData & {
    parsed_nik: ReturnType<(typeof import('nik-parser-jurusid'))['nikParserStrict']> | null;
    gender: 'Laki-laki' | 'Perempuan' | 'Tidak Diketahui';
  };

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      skrin_username: string;
      skrin_password: string;
      SPREADSHEET_ID: string;
      index_start: string;
      index_end: string;
      GITHUB_TOKEN: string;
    }
  }
}
