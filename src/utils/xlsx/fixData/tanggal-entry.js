import ansiColors from 'ansi-colors';
import moment from 'moment';
import { array_random } from 'sbg-utility';
import { extractMonthName, getDatesWithoutSundays } from '../../../date.js';
import { logLine } from '../../../utils.js';

/**
 * Normalize and validate TANGGAL ENTRY (entry date).
 *
 * This function handles entry date normalization by:
 * 1. Using an existing tanggal entry value if provided
 * 2. Auto-filling with a random non-Sunday date if configured and missing
 * 3. Inferring dates from month names if specified
 * 4. Validating that the date is not a Sunday and not in the future
 *
 * @param {import('../../../globals').ExcelRowData4 | import('../../../globals').ExcelRowData | null} initialData - The full data object being processed
 * @param {object} [options={}] - Configuration options
 * @param {boolean} [options.verbose=false] - When true, logs progress messages during normalization
 * @param {boolean} [options.autofillTanggalEntry=false] - When true, auto-fills missing entry dates with random non-Sunday dates
 * @returns {{tanggalEntry: string, initialData: import('../../../globals').ExcelRowData4 | import('../../../globals').ExcelRowData}} Object containing validated entry date and updated initialData
 * @throws {Error} When TANGGAL ENTRY cannot be determined, validated, or is a Sunday/future date
 */
export function fixTanggalEntry(initialData, options = { verbose: false, autofillTanggalEntry: false }) {
  let tanggalEntry = initialData['TANGGAL ENTRY'] || initialData.tanggal || '';
  const nik = initialData.nik || initialData.NIK || null;

  if (String(tanggalEntry).trim().length === 0) {
    if (options.autofillTanggalEntry) {
      tanggalEntry = getDatesWithoutSundays('november', 2025, 'DD/MM/YYYY', true)[0];
      if (options.verbose)
        logLine(
          `${ansiColors.cyan('[fixTanggalEntry]')} Generated new tanggal entry for missing value: ${tanggalEntry}`
        );
    } else {
      throw new Error(`Tanggal entry is required.\n\n${JSON.stringify(initialData, null, 2)}\n`);
    }
  }

  if (!moment(tanggalEntry, 'DD/MM/YYYY', true).isValid()) {
    if (
      typeof tanggalEntry === 'string' &&
      /\b(jan(uari)?|feb(ruari)?|mar(et)?|apr(il)?|mei|jun(i|e)?|jul(i|y)?|agu(stus)?|aug(ust)?|sep(tember)?|okt(ober)?|oct(ober)?|nov(ember)?|des(ember)?|dec(ember)?|bln\s+\w+|bulan\s+\w+)\b/i.test(
        tanggalEntry
      )
    ) {
      const monthName = extractMonthName(tanggalEntry);
      if (!monthName)
        throw new Error(
          `Month name not found in tanggalEntry: ${tanggalEntry}\n\n${JSON.stringify(initialData, null, 2)}`
        );
      tanggalEntry = array_random(getDatesWithoutSundays(monthName, 2025, 'DD/MM/YYYY', true));
      if (options.verbose)
        logLine(
          `${ansiColors.cyan('[fixTanggalEntry]')} Generated new date for "${tanggalEntry}" from month name in entry: ${tanggalEntry}`
        );
    }
    const reparseTanggalEntry = moment(tanggalEntry, 'DD/MM/YYYY', true);
    if (reparseTanggalEntry.day() === 0)
      throw new Error(`Tanggal entry cannot be a Sunday: ${tanggalEntry}\n\n${JSON.stringify(initialData, null, 2)}`);
    if (!reparseTanggalEntry.isValid()) {
      throw new Error(
        `Invalid tanggalEntry format: ${tanggalEntry} (expected DD/MM/YYYY)\n\n${JSON.stringify(initialData, null, 2)}`
      );
    }
  } else {
    const parsedDate = moment(tanggalEntry, 'DD/MM/YYYY', true);
    // Check if the date is a Sunday
    if (parsedDate.day() === 0) {
      throw new Error(`Tanggal entry cannot be a Sunday: ${tanggalEntry}\n\n${JSON.stringify(initialData, null, 2)}`);
    }
    // Check if the date is not greater than today
    if (parsedDate.isAfter(moment())) {
      throw new Error(
        `Tanggal entry ${nik} cannot be in the future: ${tanggalEntry}\n\n${JSON.stringify(initialData, null, 2)}`
      );
    }
  }

  if (options.verbose) logLine(`${ansiColors.cyan('[fixTanggalEntry]')} Tanggal entry fixed: ${tanggalEntry}`);

  initialData.tanggal = tanggalEntry;
  initialData['TANGGAL ENTRY'] = tanggalEntry;

  return { tanggalEntry, initialData };
}
