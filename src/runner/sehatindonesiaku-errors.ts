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
