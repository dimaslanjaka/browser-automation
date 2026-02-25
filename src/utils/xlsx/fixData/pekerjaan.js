import ansiColors from 'ansi-colors';
import { logLine } from '../../../utils.js';

/**
 * Normalize and map pekerjaan (occupation) to a canonical value.
 *
 * This function handles pekerjaan normalization by:
 * 1. Using an existing pekerjaan value if provided
 * 2. Inferring a default based on age and gender if missing
 * 3. Mapping the pekerjaan to a canonical value using predefined patterns
 *
 * @param {import('../../../globals').ExcelRowData4 | import('../../../globals').ExcelRowData | null} initialData - The full data object being processed
 * @param {object} [options={}] - Configuration options
 * @param {boolean} [options.verbose=false] - When true, logs progress messages during normalization
 * @returns {{pekerjaan: string, initialData: import('../../../globals').ExcelRowData4 | import('../../../globals').ExcelRowData, pekerjaan_original: string}} Object containing normalized pekerjaan and updated initialData
 * @throws {Error} When pekerjaan cannot be determined or mapped to a valid category
 */
export function fixPekerjaan(initialData, options = { verbose: false }) {
  let pekerjaan = initialData.pekerjaan || initialData.PEKERJAAN || null;
  const age = initialData.age || 0;
  const gender = initialData.gender || null;
  // If pekerjaan is not provided, infer a default based on age and gender
  if (!pekerjaan) {
    if (age > 55 || age <= 20) {
      pekerjaan = 'Tidak Bekerja';
    } else {
      pekerjaan = gender && gender.toLowerCase() === 'perempuan' ? 'IRT' : 'Wiraswasta';
    }
  } else {
    if (options.verbose) logLine(`${ansiColors.cyan('[fixPekerjaan]')} Pekerjaan: ${pekerjaan}`);
  }

  // Define job mapping patterns
  const jobMappings = [
    { pattern: /rumah\s*tangga|irt/i, value: 'IRT' },
    { pattern: /swasta|pedagang/i, value: 'Wiraswasta' },
    { pattern: /tukang|buruh/i, value: 'Buruh ' },
    { pattern: /tidak\s*bekerja|belum\s*bekerja|pensiun|belum\/tidak\s*bekerja/i, value: 'Tidak Bekerja' },
    { pattern: /pegawai\s*negeri(\s*sipil)?|pegawai\s*negri/i, value: 'PNS ' },
    { pattern: /guru|dosen/i, value: 'Guru/ Dosen' },
    { pattern: /perawat|dokter/i, value: 'Tenaga Profesional Medis ' },
    { pattern: /pengacara|wartawan/i, value: 'Tenaga Profesional Non Medis ' },
    { pattern: /pelajar|siswa|siswi|sekolah/i, value: 'Pelajar/ Mahasiswa' },
    { pattern: /s[o,u]pir/i, value: 'Sopir ' }
  ];

  // Map pekerjaan to canonical value
  for (const { pattern, value } of jobMappings) {
    if (pattern.test(pekerjaan.toLowerCase())) {
      pekerjaan = value;
      if (options.verbose) logLine(`${ansiColors.cyan('[fixPekerjaan]')} Pekerjaan mapped: ${pekerjaan}`);
      break;
    }
  }

  // Validate that pekerjaan was successfully determined
  if (!pekerjaan) {
    throw new Error(`Pekerjaan could not be determined for age: ${age}, gender: ${gender}`);
  }

  if (options.verbose) logLine(`${ansiColors.cyan('[fixPekerjaan]')} Pekerjaan fixed: ${pekerjaan}`);

  initialData.pekerjaan = pekerjaan;
  initialData.PEKERJAAN = pekerjaan;

  return { pekerjaan, initialData, pekerjaan_original: initialData.pekerjaan };
}
