export class DataTidakSesuaiKTPError extends Error {
  constructor(nik: string) {
    super(`❌ Data tidak sesuai KTP for NIK: ${nik}`);
    this.name = 'DataTidakSesuaiKTPError';
  }
}
export class PembatasanUmurError extends Error {
  constructor(nik: string) {
    super(`❌ Pembatasan Umur Pemeriksaan is displayed for NIK: ${nik}`);
    this.name = 'PembatasanUmurError';
  }
}
export class UnauthorizedError extends Error {
  constructor() {
    super(`❌ Login required`);
    this.name = 'UnauthorizedError';
  }
}
export class KuotaHabisError extends Error {
  constructor(nik: string) {
    super(`❌ Kuota pemeriksaan habis for NIK: ${nik}`);
    this.name = 'KuotaHabisError';
  }
}
export class ErrorDataKehadiranNotFound extends Error {
  constructor(nik: string) {
    super(`❌ Data Kehadiran not found for NIK: ${nik}`);
    this.name = 'ErrorDataKehadiranNotFound';
  }
}
export class DataNotFound extends Error {
  constructor(nik: string) {
    super(`❌ Data not found for NIK: ${nik}`);
    this.name = 'DataNotFound';
  }
}
export class TanggalPemeriksaanError extends Error {
  constructor(nik: string) {
    super(`❌ Tanggal Pemeriksaan tidak valid for NIK: ${nik}`);
    this.name = 'TanggalPemeriksaanError';
  }
}
