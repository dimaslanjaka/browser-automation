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
  parsed_nik?: {
    nama: string;
    kelamin: string;
    lahir: string;
    kotakab: string;
    kecamatan: string;
    uniqcode: string;
    nik: string;
  };
}
