import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('fetchXlsxData4', () => {
  let fetchXlsxData4;
  beforeEach(async () => {
    jest.clearAllMocks();
    ({ fetchXlsxData4 } = await import('../src/fetchXlsxData4.js'));
  });

  it('returns expected headers for the first data row', async () => {
    const result = await fetchXlsxData4();
    // Just verify the headers of the first row
    const headers = Object.keys(result[0] || {});
    expect(headers).toEqual(
      expect.arrayContaining([
        'TANGGAL ENTRY',
        'NAMA',
        'NIK',
        'TGL LAHIR',
        'ALAMAT',
        'BB',
        'TB',
        'PETUGAS ENTRY',
        'originalRowNumber'
      ])
    );
  });
});
