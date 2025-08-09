export interface DataItem {
  tanggal?: string;
  nama?: string;
  nik?: string;
  pekerjaan?: string;
  bb?: string;
  tb?: string;
  batuk?: string;
  diabetes?: string;
  tgl_lahir?: string;
  alamat?: string;
  jenis_kelamin?: string;
  petugas?: string;
  rowIndex: number;
  originalTglLahir?: string;
}

export type DataArray = DataItem[];