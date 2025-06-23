export type Gender = 'LAKI-LAKI' | 'PEREMPUAN';

export interface NikTambahan {
  [keyof: string]: string; // Additional fields can be added as needed
  kodepos: string; // Postal code
  pasaran: string; // Javanese market day (e.g., "Senin Kliwon, 01 Januari 1990")
  usia: string; // Age in "X Tahun Y Bulan Z Hari"
  ultah: string; // Birthday countdown (e.g., "2 Bulan 14 Hari Lagi")
  zodiak: string; // Zodiac sign (e.g., "Capricorn")
}

export interface NikData {
  nik: string; // Original NIK number
  kelamin: Gender; // Gender
  lahir: string; // Birth date in "DD/MM/YYYY"
  provinsi: string; // Province name
  kotakab: string; // City or Regency name
  kecamatan: string; // District name
  uniqcode: string; // Unique code (last 4 digits)
  tambahan: NikTambahan; // Additional info
}

export interface NikResult {
  status: 'success' | 'error'; // Result status
  pesan: string; // Human-readable message
  data?: NikData; // Parsed data (only if success)
}
