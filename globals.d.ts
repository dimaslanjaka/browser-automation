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
  parsed_nik?: null | {
    nama: string;
    kelamin: string;
    lahir: string;
    kotakab: string;
    kecamatan: string;
    uniqcode: string;
    provinsi: string;
    nik: string;
    tambahan: {
      kodepos: string;
      usia: string;
      ultah: string;
    };
  };
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
