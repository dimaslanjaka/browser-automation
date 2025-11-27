import ansiColors from 'ansi-colors';
import { geocodeWithNominatim } from '../../../address/nominatim.js';
import { logLine } from '../../../utils.js';

/**
 * Normalize and validate alamat (address) field.
 *
 * This function handles address resolution by:
 * 1. Using an existing alamat value if provided
 * 2. Inferring address from parsed NIK data if available
 * 3. Geocoding with Nominatim to fill in missing address components
 * 4. Normalizing city/town names (e.g., "Kota Adm. Surabaya" -> "Kota Surabaya")
 *
 * @param {string | null} alamat - The raw alamat value to normalize
 * @param {object} parsedNik - The parsed NIK object (must have status and data properties)
 * @param {string} nik - The NIK number (used in error messages)
 * @param {import('../../../globals').ExcelRowData4 | import('../../../globals').ExcelRowData | null} initialData - The full data object being processed
 * @param {object} dataRef - Reference to the data object where _address will be stored
 * @param {object} [options={}] - Configuration options
 * @param {boolean} [options.verbose=false] - When true, logs progress messages
 * @returns {Promise<{alamat: string, data: import('../../../globals').ExcelRowData4 | import('../../../globals').ExcelRowData}>} Object containing normalized alamat and updated initialData
 * @throws {Error} When alamat cannot be determined or resolved
 */
export async function fixAlamat(alamat, parsedNik, nik, initialData, dataRef, options = { verbose: false }) {
  if (!alamat) {
    if (parsedNik && parsedNik.status === 'success') {
      const parsed_data = parsedNik.data;
      alamat = [parsed_data.kelurahan?.[0]?.name, parsed_data.namaKec, parsed_data.kotakab, parsed_data.provinsi]
        .filter((part) => part !== undefined && part !== null && part !== '')
        .join(', ');
      if (options.verbose) logLine(`${ansiColors.cyan('[fixAlamat]')} Alamat from parsed NIK: ${alamat}`);

      const keywordAddr = `${parsed_data.kelurahan}, ${parsed_data.namaKec}, Surabaya, Jawa Timur`.trim();
      const address = await geocodeWithNominatim(keywordAddr);
      dataRef._address = address;

      let { kotakab = '', namaKec = '', provinsi = '', kelurahan = [] } = parsed_data;

      if (kotakab.length === 0 || namaKec.length === 0 || provinsi.length === 0) {
        if (options.verbose)
          logLine(`${ansiColors.cyan('[fixAlamat]')} Fetching address from Nominatim for: ${keywordAddr}`);
        if (options.verbose) logLine(`${ansiColors.cyan('[fixAlamat]')} Nominatim result:`, address);

        const addr = address.address || {};

        if (kelurahan.length === 0) kelurahan = [addr.village || addr.hamlet || ''];
        if (namaKec.length === 0) namaKec = addr.suburb || addr.city_district || '';
        if (kotakab.length === 0) kotakab = addr.city || addr.town || addr.village || 'Kota Surabaya';
        if (provinsi.length === 0) provinsi = addr.state || addr.province || 'Jawa Timur';

        if (kotakab.toLowerCase().includes('surabaya')) {
          kotakab = 'Kota Surabaya';
        }

        if (kotakab.length === 0 || namaKec.length === 0) {
          throw new Error(`❌ Failed to take the patient's city or town\n\n${JSON.stringify(initialData, null, 2)}`);
        }

        parsed_data.kelurahan = kelurahan;
        parsed_data.namaKec = namaKec;
        parsed_data.kotakab = kotakab;
        parsed_data.provinsi = provinsi;
        initialData.parsed_nik.data = parsed_data; // Update parsed_nik with new data
      }
    } else {
      throw new Error(`Alamat is required for NIK: ${nik}\n\n${JSON.stringify(initialData, null, 2)}`);
    }
  }

  // Normalize city/town names in parsed_nik
  if (initialData.parsed_nik && initialData.parsed_nik.status === 'success') {
    const parsed_data = initialData.parsed_nik.data;
    if (/kota adm\.?/i.test(parsed_data.kotakab.toLowerCase())) {
      parsed_data.kotakab = parsed_data.kotakab.replace(/kota adm\.?/i, 'kota').trim();
      if (options.verbose) {
        logLine(`${ansiColors.cyan('[fixAlamat]')} Normalized kotakab: ${parsed_data.kotakab}`);
      }
    }
    initialData.parsed_nik.data = parsed_data; // Update parsed_nik with new data
  }

  if (options.verbose) logLine(`${ansiColors.cyan('[fixAlamat]')} Alamat fixed: ${alamat}`);

  return { alamat, data: initialData };
}
