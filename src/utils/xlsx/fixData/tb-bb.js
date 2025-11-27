import { getBeratBadan, getTinggiBadan } from '../../../skrin_utils.js';
import { logLine } from '../../../utils.js';
import ansiColors from 'ansi-colors';

/**
 * Normalize and validate TB (tinggi/height) and BB (berat/weight).
 *
 * This function handles height and weight normalization by:
 * 1. Using existing TB and BB values if provided
 * 2. Inferring values based on age and gender if missing
 * 3. Ensuring both lowercase and uppercase property keys are set
 *
 * @param {import('../../../globals').ExcelRowData4 | import('../../../globals').ExcelRowData | null} initialData - The full data object being processed
 * @param {object} [options={}] - Configuration options
 * @param {boolean} [options.verbose=false] - When true, logs progress messages during normalization
 * @returns {{tb: number, bb: number, initialData: import('../../../globals').ExcelRowData4 | import('../../../globals').ExcelRowData}} Object containing normalized height, weight, and updated initialData
 * @throws {Error} When TB or BB cannot be determined
 */
export function fixTbBb(initialData, options = { verbose: false }) {
  const age = initialData.age || 0;
  const gender = initialData.gender || null;
  let tinggi = initialData.TB || initialData.tb || null;
  let berat = initialData.bb || initialData.BB || null;

  if (!tinggi) {
    tinggi = getTinggiBadan(age, gender);
    if (options.verbose) {
      logLine(`${ansiColors.cyan('[fixTbBb]')} Generated TB (height) from age and gender: ${tinggi}`);
    }
  }

  if (!berat) {
    berat = getBeratBadan(age, gender);
    if (options.verbose) {
      logLine(`${ansiColors.cyan('[fixTbBb]')} Generated BB (weight) from age and gender: ${berat}`);
    }
  }

  if (options.verbose) logLine(`${ansiColors.cyan('[fixTbBb]')} TB and BB fixed: TB=${tinggi}, BB=${berat}`);

  // Ensure both lowercase and uppercase keys are set
  initialData.tb = tinggi;
  initialData.TB = tinggi;
  initialData.bb = berat;
  initialData.BB = berat;

  return { tb: tinggi, bb: berat, initialData };
}
