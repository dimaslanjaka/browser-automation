'use strict';

require('../chunk-4IBVXDKH.cjs');

class DataTidakSesuaiKTPError extends Error {
  constructor(nik) {
    super(`\u274C Data tidak sesuai KTP for NIK: ${nik}`);
    this.name = "DataTidakSesuaiKTPError";
  }
}
class PembatasanUmurError extends Error {
  constructor(nik) {
    super(`\u274C Pembatasan Umur Pemeriksaan is displayed for NIK: ${nik}`);
    this.name = "PembatasanUmurError";
  }
}
class UnauthorizedError extends Error {
  constructor() {
    super(`\u274C Login required`);
    this.name = "UnauthorizedError";
  }
}
class KuotaHabisError extends Error {
  constructor(nik) {
    super(`\u274C Kuota pemeriksaan habis for NIK: ${nik}`);
    this.name = "KuotaHabisError";
  }
}
class ErrorDataKehadiranNotFound extends Error {
  constructor(nik) {
    super(`\u274C Data Kehadiran not found for NIK: ${nik}`);
    this.name = "ErrorDataKehadiranNotFound";
  }
}
class DataNotFound extends Error {
  constructor(nik) {
    super(`\u274C Data not found for NIK: ${nik}`);
    this.name = "DataNotFound";
  }
}
class TanggalPemeriksaanError extends Error {
  constructor(nik) {
    super(`\u274C Tanggal Pemeriksaan tidak valid for NIK: ${nik}`);
    this.name = "TanggalPemeriksaanError";
  }
}

exports.DataNotFound = DataNotFound;
exports.DataTidakSesuaiKTPError = DataTidakSesuaiKTPError;
exports.ErrorDataKehadiranNotFound = ErrorDataKehadiranNotFound;
exports.KuotaHabisError = KuotaHabisError;
exports.PembatasanUmurError = PembatasanUmurError;
exports.TanggalPemeriksaanError = TanggalPemeriksaanError;
exports.UnauthorizedError = UnauthorizedError;
//# sourceMappingURL=sehatindonesiaku-errors.cjs.map
//# sourceMappingURL=sehatindonesiaku-errors.cjs.map