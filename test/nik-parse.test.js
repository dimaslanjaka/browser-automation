import { describe, expect, it, jest } from '@jest/globals';
import { nikParse } from '../src/nik-parser/index.js';

// Mock modules
jest.mock('../src/nik-parser/G.js', () => ({
  G: (h, i, j, m, d, y) => new Date(y, m - 1, d).getTime()
}));

jest.mock('../src/nik-parser/R.js', () => ({
  R: (format, date) => {
    const now = new Date();
    switch (format) {
      case 'Y':
        return now.getFullYear();
      case 'm':
        return now.getMonth() + 1;
      case 'j':
        return now.getDate();
      case 'w':
        return new Date(date).getDay();
      case 't':
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
      default:
        return 0;
    }
  }
}));

jest.mock('../src/nik-parser/T.js', () => ({
  T: (str) => parseInt(str, 10)
}));

jest.mock('../src/nik-parser/U.js', () => ({
  U: {
    provinsi: { 31: 'DKI Jakarta' },
    kabkot: { 3174: 'Jakarta Selatan' },
    kecamatan: { 317408: 'Pancoran -- 12740' }
  }
}));

describe('nikParse', () => {
  it('should return error for invalid NIK length', () => {
    const result = nikParse('123');
    expect(result.status).toBe('error');
    expect(result.pesan).toBe('NIK tidak valid');
  });

  it('should return error for unrecognized regional codes', () => {
    const result = nikParse('0000000000000000');
    expect(result.status).toBe('error');
  });

  it('should parse a valid male NIK correctly', () => {
    const nik = '3174081509980001'; // Pancoran, 15/09/1998, male
    const result = nikParse(nik);

    expect(result.status).toBe('success');
    expect(result.data.nik).toBe(nik);
    expect(result.data.kelamin.toLowerCase()).toBe('laki-laki');
    expect(result.data.lahir).toBe('15/09/1998');
    expect(result.data.provinsi.toLowerCase()).toBe('dki jakarta');
    expect(result.data.kotakab.toLowerCase()).toContain('jakarta selatan');
    expect(result.data.kecamatan.toLowerCase()).toBe('pancoran');
    expect(result.data.tambahan.zodiak).toBeDefined();
    expect(result.data.tambahan.usia).toMatch(/\d+ Tahun/);
  });

  // it('should valid NIK', () => {
  //   expect(nikParse('3678101007220001').status).toBe('success');
  // });

  it('should parse a valid female NIK correctly', () => {
    const nik = '3174084509980002'; // 45 = 5 + 40 (female), 05/09/1998
    const result = nikParse(nik);

    expect(result.status).toBe('success');
    expect(result.data.kelamin).toBe('PEREMPUAN');
    expect(result.data.lahir).toBe('05/09/1998');
  });

  it('should execute callback with result', () => {
    const callback = jest.fn();
    const nik = '3174081509980001';
    nikParse(nik, callback);
    expect(callback).toHaveBeenCalledWith(expect.objectContaining({ status: 'success' }));
  });
});
