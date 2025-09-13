import { ExcelRowData } from '../../globals';

/**
 * Select a date in a Vue-based mx-datepicker component by simulating user interaction.
 * Handles year, month, and day navigation robustly for DD/MM/YYYY format.
 * @param page Puppeteer page instance
 * @param item Data item containing tanggal_lahir in DD/MM/YYYY
 */
export interface DataItem {
  nik: string | null;
  nama: string | null;
  nomor_wa: string | null;
  tanggal_lahir: string | null;
  jenis_kelamin: string | null;
  pekerjaan: string | null;
  provinsi: string | null;
  alamat: string | null;
  tanggal_pemeriksaan: string | null;
  tinggi_badan?: number | null;
  berat_badan?: number | null;
  lingkar_perut?: number | null;
  sistolik?: number | null;
  diastolik?: number | null;
  /** Gula Darah Saat Pemeriksaan (GDS) */
  gula_darah?: number | null;
  /** Geocoding result */
  // resolved_address?: Awaited<ReturnType<typeof resolveAddress>>;
  [key: string]: any;
}

export interface DataMerged extends DataItem {
  [key: string]: any;
  hadir?: boolean;
  registered?: boolean;
}

export interface DebugItem extends DataItem {
  type: 'excel' | 'db';
  registered?: boolean;
  pelayanan?: boolean;
  hadir?: boolean;
}

export interface SkrinData extends ExcelRowData {
  [key: string]: any;
  skip?: boolean;
}
