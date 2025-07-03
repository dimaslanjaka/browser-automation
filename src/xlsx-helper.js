/**
 * Find data rows by NIK
 * @param {import('../globals').ExcelRowData[]} datas - Array of Excel data
 * @param {string} targetNik - NIK to search for
 * @returns {import('../globals').ExcelRowData|null} Found data or null
 */
export function findByNik(datas, targetNik) {
  return datas.find((item) => item.nik === targetNik) || null;
}

/**
 * Matches the first and last data against expected values
 * @param {import('../globals').ExcelRowData[]} datas - Array of Excel data
 * @param {Object} matchData - Expected first and last data
 * @returns {Object} Matching results
 */
export function matchFirstAndLastData(datas, matchData) {
  const firstItem = datas.at(0);
  const lastItem = datas.at(-1);

  const firstMatch = {
    nikMatch: firstItem?.nik === matchData.first.nik,
    namaMatch: firstItem?.nama === matchData.first.nama,
    actualNik: firstItem?.nik,
    actualNama: firstItem?.nama,
    expectedNik: matchData.first.nik,
    expectedNama: matchData.first.nama
  };

  const lastMatch = {
    nikMatch: lastItem?.nik === matchData.last.nik,
    namaMatch: lastItem?.nama === matchData.last.nama,
    actualNik: lastItem?.nik,
    actualNama: lastItem?.nama,
    expectedNik: matchData.last.nik,
    expectedNama: matchData.last.nama
  };

  return {
    first: firstMatch,
    last: lastMatch,
    overallMatch: firstMatch.nikMatch && firstMatch.namaMatch && lastMatch.nikMatch && lastMatch.namaMatch
  };
}
