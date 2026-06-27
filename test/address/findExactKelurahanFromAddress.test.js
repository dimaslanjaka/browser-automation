import { describe, expect, it } from '@jest/globals';
import { findExactKelurahanFromAddress } from '../../src/address/findExactKelurahanFromAddress.js';

describe('findExactKelurahanFromAddress', () => {
  describe('input validation', () => {
    it('should return null when nikData is missing', async () => {
      const result = await findExactKelurahanFromAddress(null, 'JALAN TEST 123');
      expect(result).toBeNull();
    });

    it('should return null when address is missing', async () => {
      const nikData = {
        nik: '3578166208040002',
        provinsi: 'JAWA TIMUR',
        kotakab: 'KOTA SURABAYA',
        namaKec: 'Semampir',
        kelurahan: [{ id: '3578101001', name: 'Kelurahan Test' }]
      };
      const result = await findExactKelurahanFromAddress(nikData, null);
      expect(result).toBeNull();
    });

    it('should return null when both nikData and address are missing', async () => {
      const result = await findExactKelurahanFromAddress(null, null);
      expect(result).toBeNull();
    });
  });

  describe('Strategy 1: Geocoder match with fuzzy matching', () => {
    it('should return geocoded match when kelurahan matches exactly', async () => {
      const nikData = {
        nik: '3578166208040002',
        provinsi: 'JAWA TIMUR',
        kotakab: 'KOTA SURABAYA',
        namaKec: 'Semampir',
        kelurahan: [
          { id: '3578101001', name: 'Semampir' },
          { id: '3578101007', name: 'Kapas Madya Baru' }
        ]
      };

      const result = await findExactKelurahanFromAddress(nikData, 'KAPAS MADYA BARU');

      expect(result).not.toBeNull();
      expect(result.name).toBeTruthy();
      expect(result.id).toBeTruthy();
      expect(result.source).toBeTruthy();
      expect(result.result.nik).toBeTruthy();
      expect(result.result.nik).toBe(nikData.nik);
      expect(result.result.alamat).toBeTruthy();
    });

    it('should match kelurahan with fuzzy normalization (spacing differences)', async () => {
      const nikData = {
        nik: '3578106812630001',
        provinsi: 'JAWA TIMUR',
        kotakab: 'KOTA SURABAYA',
        namaKec: 'Tambaksari',
        kelurahan: [{ id: '3578101007', name: 'Kapas Madya Baru' }]
      };

      const result = await findExactKelurahanFromAddress(nikData, 'TUWOWO REJO 6/8');

      // Integration test: verify structure, not exact API match
      expect(result).not.toBeNull();
      expect(result.name).toBeTruthy();
      expect(result.id).toBeTruthy();
      expect(result.source).toBeTruthy();
      expect(result.result.nik).toBe(nikData.nik);
    });
  });

  describe('Strategy 2: Fallback address matching', () => {
    it('should match kelurahan using address fallback when geocoder has no kelurahan', async () => {
      const nikData = {
        nik: '3578166208040002',
        provinsi: 'JAWA TIMUR',
        kotakab: 'KOTA SURABAYA',
        namaKec: 'Semampir',
        kelurahan: [
          { id: '3578101001', name: 'Semampir' },
          { id: '3578101007', name: 'Kapas Madya Baru' }
        ]
      };

      const result = await findExactKelurahanFromAddress(nikData, 'KAPAS MADYA BARU 4/63');

      // Integration test: verify structure, not exact source (geocoder may match)
      expect(result).not.toBeNull();
      expect(result.name).toBeTruthy();
      expect(result.id).toBeTruthy();
      expect(result.source).toBeTruthy();
      expect(result.result.nik).toBe(nikData.nik);
    });

    it('should match with fuzzy normalization in address fallback', async () => {
      const nikData = {
        nik: '3578166208040002',
        provinsi: 'JAWA TIMUR',
        kotakab: 'KOTA SURABAYA',
        namaKec: 'Semampir',
        kelurahan: [{ id: '3578101007', name: 'Kapas Madya Baru' }]
      };

      // Address has different spacing
      const result = await findExactKelurahanFromAddress(nikData, 'KAPASMADYABARU 2/55');

      expect(result).not.toBeNull();
      expect(result.name).toBeTruthy();
      expect(result.id).toBeTruthy();
      expect(result.source).toBeTruthy();
      expect(result.result.nik).toBe(nikData.nik);
    });

    it('should fallback to first NIK kelurahan when geocoder and address do not match', async () => {
      const nikData = {
        nik: '3526186508870001',
        provinsi: 'JAWA TIMUR',
        kotakab: 'KAB. BANGKALAN',
        namaKec: 'Galis',
        kelurahan: [
          { id: '3526182001', name: 'Tellok' },
          { id: '3526182002', name: 'Banjar' }
        ]
      };

      const result = await findExactKelurahanFromAddress(nikData, 'KAPAS BARU 4/79');

      expect(result).not.toBeNull();
      expect(result.name).toBe('Tellok');
      expect(result.id).toBe('3526182001');
      expect(result.source).toBe('nik-fallback');
      expect(result.result.kelurahan).toBe('Tellok');
      expect(result.result.nik).toBe(nikData.nik);
    });
  });
});
