export interface ExcelRowData {
  rowIndex: number;
  tanggal: string;
  nama: string;
  nik: string; // Should be at least 16 characters
  pekerjaan: string;
  bb: number;
  tb: number;
  batuk?: string;
  diabetes?: string;
  tgl_lahir?: string;
  alamat?: string;
  jenis_kelamin?: string;
  petugas?: string;
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

export interface fixDataResult extends ExcelRowData, ExcelRowData4 {
  parsed_nik: ReturnType<(typeof import('nik-parser-jurusid'))['nikParserStrict']> | null;
  gender: 'Laki-laki' | 'Perempuan' | 'Tidak Diketahui';
  age: number;
}

export type Region0Row = Partial<ExcelRowData> & { headerRegion: 0; originalRowNumber: number };
export type Region1Row = Partial<ExcelRowData> & { headerRegion: 1; originalRowNumber: number };
export type FetchXlsxData4Result = Array<Region0Row | Region1Row>;

declare global {
  namespace NodeJS {
    interface ProcessEnv {
      skrin_username: string;
      skrin_password: string;
      SPREADSHEET_ID: string;
      index_start: string;
      index_end: string;
      GITHUB_TOKEN: string;
      GITLAB_TOKEN: string;
      OPENAI_KEY: string;
    }
  }
}
