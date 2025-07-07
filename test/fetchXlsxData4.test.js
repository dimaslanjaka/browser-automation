import { beforeEach, describe, expect, it, jest } from '@jest/globals';

describe('fetchXlsxData4', () => {
  let fetchXlsxData4;
  beforeEach(async () => {
    jest.clearAllMocks();
    ({ fetchXlsxData4 } = await import('../src/fetchXlsxData4.js'));
  });

  it('returns expected keys for the first data row (supports both header regions)', async () => {
    const result = await fetchXlsxData4();
    const headers = Object.keys(result[0] || {});
    // Accept either region's headers
    const region0 = [
      'TANGGAL',
      'NAMA',
      'NIK',
      'PEKERJAAN',
      'BERAT BADAN',
      'TINGGI BADAN',
      'DM',
      'PETUGAS YG MENG ENTRY',
      'originalRowNumber',
      'headerRegion'
    ];
    const region1 = [
      'TANGGAL ENTRY',
      'NAMA',
      'NIK',
      'TGL LAHIR',
      'ALAMAT',
      'BB',
      'TB',
      'PETUGAS ENTRY',
      'originalRowNumber',
      'headerRegion'
    ];
    // The row should contain at least these keys
    expect(headers).toEqual(expect.arrayContaining(['NAMA', 'NIK', 'originalRowNumber', 'headerRegion']));
    // And should match one of the known header sets
    const matchesRegion1 = region1.every((h) => headers.includes(h));
    const matchesRegion0 = region0.every((h) => headers.includes(h));
    expect(matchesRegion1 || matchesRegion0).toBe(true);
  });

  it('parses rows from both header regions and sets headerRegion correctly', async () => {
    const result = await fetchXlsxData4();
    // Find at least one row from each region
    const before7488 = result.find((row) => row.headerRegion === 0);
    const after7488 = result.find((row) => row.headerRegion === 1);
    expect(before7488).toBeDefined();
    expect(after7488).toBeDefined();
    // Check that headerRegion is set correctly
    expect([0, 1]).toContain(before7488.headerRegion);
    expect([0, 1]).toContain(after7488.headerRegion);
    // Optionally, check that headers are as expected for each region
    expect(Object.keys(before7488)).toContain('originalRowNumber');
    expect(Object.keys(after7488)).toContain('originalRowNumber');
  });

  it('verify header before7488 and after7488', async () => {
    const result = await fetchXlsxData4();
    const before7488Headers = Object.keys(result.find((row) => row.headerRegion === 0) || {});
    const after7488Headers = Object.keys(result.find((row) => row.headerRegion === 1) || {});

    // Check that both headers contain expected keys
    expect(before7488Headers).toEqual(expect.arrayContaining(['TANGGAL', 'NAMA', 'NIK', 'PEKERJAAN']));
    expect(after7488Headers).toEqual(expect.arrayContaining(['TANGGAL ENTRY', 'NAMA', 'NIK', 'TGL LAHIR']));

    // Ensure index 7489 is nik value 3578106311200003
    const foundRow = result.find((row) => row.originalRowNumber === 7489);
    expect(foundRow).toBeDefined();
    expect(foundRow.NIK).toBe('3578106311200003');
  });

  it('should not return duplicate NIKs (only latest/region 1)', async () => {
    const data = await fetchXlsxData4();
    const nikCounts = data.reduce((acc, item) => {
      if (item.NIK) {
        acc[item.NIK] = (acc[item.NIK] || 0) + 1;
      }
      return acc;
    }, {});
    const duplicates = Object.entries(nikCounts).filter(([_, count]) => count > 1);
    expect(duplicates.length).toBe(0);
  });

  it('should return the region 1 object for a NIK present in both regions', async () => {
    const data = await fetchXlsxData4();
    const found = data.find((item) => item.NIK === '3578106311200003');
    expect(found).toBeDefined();
    expect(found.headerRegion).toBe(1);
    expect(found.originalRowNumber).toBe(7489);
    expect(found.NAMA).toBe('NI NYOMAN ANINDYA MAHESWARI');
  });
});
