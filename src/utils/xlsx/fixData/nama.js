import { parseBabyName } from '../../../runner/skrin-utils.js';
import { logLine } from '../../../utils.js';
import ansiColors from 'ansi-colors';

/**
 * Normalize and validate NAMA (name).
 *
 * This function handles name normalization by:
 * 1. Trimming and collapsing whitespace
 * 2. Removing quotation marks
 * 3. Validating minimum length (3 characters)
 * 4. Optionally parsing baby names (e.g., "Bayi Laki-laki" -> "")
 * 5. Ensuring both lowercase and uppercase property keys are set
 *
 * @param {import('../../../globals').ExcelRowData4 | import('../../../globals').ExcelRowData | null} initialData - The full data object being processed
 * @param {object} [options={}] - Configuration options
 * @param {boolean} [options.verbose=false] - When true, logs progress messages during normalization
 * @param {boolean} [options.fixNamaBayi=false] - When true, parses baby names (e.g., "Bayi Laki-laki"); when false, allows baby names as-is
 * @returns {{nama: string, initialData: import('../../../globals').ExcelRowData4 | import('../../../globals').ExcelRowData}} Object containing normalized name and updated initialData
 * @throws {Error} When NAMA is missing or invalid (length < 3 characters)
 */
export function fixNama(initialData, options = { verbose: false, fixNamaBayi: false }) {
  let nama = initialData.NAMA || initialData.nama || null;

  if (!nama) {
    throw new Error(`Invalid data format: NAMA is required\n\n${JSON.stringify(initialData, null, 2)}`);
  }

  let normalizedNama = nama
    // Remove extra spaces
    .replace(/\s+/g, ' ')
    // Remove quotation marks
    .replace(/['"]/g, '')
    .trim();

  if (normalizedNama.length < 3) {
    throw new Error(
      `Invalid NAMA length: ${normalizedNama} (expected at least 3 characters)\n\n${JSON.stringify(initialData, null, 2)}`
    );
  }

  if (options.verbose) logLine(`${ansiColors.cyan('[fixNama]')} Normalized nama: ${normalizedNama}`);

  // Fix bayi substring (if enabled)
  if (options.fixNamaBayi && /bayi/i.test(normalizedNama)) {
    const namaBayi = parseBabyName(normalizedNama);
    if (namaBayi) {
      if (options.verbose) console.log(`Parsed baby name: "${normalizedNama}" -> "${namaBayi}"`);
      normalizedNama = namaBayi;
    } else {
      if (options.verbose) console.log(`Failed to parse baby name: "${normalizedNama}"`);
    }
    // Verify that the name was successfully parsed
    if (/bayi/i.test(normalizedNama)) {
      throw new Error(
        `Failed to parse baby name from NAMA: ${normalizedNama}\n\n${JSON.stringify(initialData, null, 2)}`
      );
    }
  }

  // Ensure both lowercase and uppercase keys are set
  initialData.nama = normalizedNama;
  initialData.NAMA = normalizedNama;

  return { nama: normalizedNama, initialData };
}
