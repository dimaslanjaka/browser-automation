import ansiColors from 'ansi-colors';
import moment from 'moment';
import { getAge } from '../../../utils/date.js';
import { logLine } from '../../../utils.js';

/**
 * Normalize and validate TGL LAHIR (birth date) and calculate age.
 *
 * This function handles birth date normalization by:
 * 1. Converting Excel serial dates to DD/MM/YYYY format
 * 2. Validating date formats and values
 * 3. Inferring missing dates from parsed NIK data
 * 4. Calculating age from the validated birth date
 *
 * @param {import('../../../globals').ExcelRowData4 | import('../../../globals').ExcelRowData | null} initialData - The full data object being processed
 * @param {object} [options={}] - Configuration options
 * @param {boolean} [options.verbose=false] - When true, logs progress messages during normalization
 * @returns {{age: number, initialData: import('../../../globals').ExcelRowData4 | import('../../../globals').ExcelRowData}} Object containing calculated age and updated initialData
 * @throws {Error} When TGL LAHIR cannot be determined or validated
 */
export function fixBirth(initialData, options = { verbose: false }) {
  let age = 0;
  let tglLahir = initialData['TGL LAHIR'] || initialData.tgl_lahir || null;
  const parsed_nik = initialData.parsed_nik || null;

  if (tglLahir) {
    if (typeof tglLahir === 'number') {
      // Convert Excel serial date to DD/MM/YYYY
      const baseDate = moment('1900-01-01');
      let days = tglLahir - 1;
      if (days > 59) days--;
      tglLahir = baseDate.add(days, 'days').format('DD/MM/YYYY');
      logLine(`${ansiColors.cyan('[fixBirth]')} Converted Excel serial date to: ${tglLahir}`);
    } else if (typeof tglLahir === 'string' && !moment(tglLahir, 'DD/MM/YYYY', true).isValid()) {
      // Try to get data from parsed NIK if available
      if (
        parsed_nik &&
        parsed_nik.status === 'success' &&
        parsed_nik.data.lahir &&
        moment(parsed_nik.data.lahir, 'DD/MM/YYYY', true).isValid()
      ) {
        if (options.verbose) {
          logLine(`${ansiColors.cyan('[fixBirth]')} Corrected TGL LAHIR from NIK: ${parsed_nik.data.lahir}`);
        }
        tglLahir = parsed_nik.data.lahir;
        if (options.verbose) logLine(`${ansiColors.cyan('[fixBirth]')} Corrected TGL LAHIR from NIK: ${tglLahir}`);
      } else {
        throw new Error(
          `Invalid TGL LAHIR format: ${tglLahir} (expected DD/MM/YYYY)\n\n${JSON.stringify(initialData, null, 2)}`
        );
      }
    }

    // Validate the final tglLahir format
    if (!moment(tglLahir, 'DD/MM/YYYY', true).isValid()) {
      throw new Error(
        `Invalid TGL LAHIR date: ${tglLahir} (expected DD/MM/YYYY)\n\n${JSON.stringify(initialData, null, 2)}`
      );
    }

    // Check if year of TGL LAHIR is more than current year
    const yearOfTglLahir = moment(tglLahir, 'DD/MM/YYYY').year();
    const currentYear = moment().year();
    if (yearOfTglLahir > currentYear) {
      if (parsed_nik && parsed_nik.status === 'success' && parsed_nik.data.lahir) {
        tglLahir = parsed_nik.data.lahir;
        if (options.verbose) logLine(`${ansiColors.cyan('[fixBirth]')} Corrected TGL LAHIR from NIK: ${tglLahir}`);
      } else {
        throw new Error(
          `TGL LAHIR year cannot be greater than current year: ${tglLahir}\n\n${JSON.stringify(initialData, null, 2)}`
        );
      }
    }

    initialData['TGL LAHIR'] = tglLahir;
  }

  // Age calculation
  let birthDate = initialData.tgl_lahir || initialData['TGL LAHIR'] || null;
  if (birthDate) {
    // Validate and parse birthDate
    if (!moment(birthDate, 'DD/MM/YYYY', true).isValid()) {
      if (
        parsed_nik &&
        parsed_nik.status === 'success' &&
        parsed_nik.data.lahir &&
        moment(parsed_nik.data.lahir, 'DD/MM/YYYY', true).isValid()
      ) {
        birthDate = parsed_nik.data.lahir;
        if (options.verbose) logLine(`${ansiColors.cyan('[fixBirth]')} Age from NIK: ${age} years`);
      }
    }
    age = getAge(birthDate, 'DD/MM/YYYY');
    if (options.verbose) logLine(`${ansiColors.cyan('[fixBirth]')} Age from TGL LAHIR: ${age} years`);
  } else if (parsed_nik && parsed_nik.status === 'success' && parsed_nik.data.lahir) {
    age = getAge(parsed_nik.data.lahir);
    if (options.verbose) logLine(`${ansiColors.cyan('[fixBirth]')} Age from NIK: ${age} years`);
  }

  if (options.verbose)
    logLine(`${ansiColors.cyan('[fixBirth]')} Birth date and age fixed: ${tglLahir}, Age: ${age} years`);

  return { age, initialData };
}
