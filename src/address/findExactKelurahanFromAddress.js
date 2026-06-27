import { getStreetAddressInformation } from './index.js';

/**
 * Find exact kelurahan from NIK data and address using geocoding and fuzzy matching.
 *
 * @param {Object} nikData - Parsed NIK address data
 * @param {string} nikData.nik - NIK number
 * @param {string} nikData.provinsi - Province name
 * @param {string} nikData.kotakab - City/Regency (e.g., "KOTA SURABAYA")
 * @param {string} nikData.namaKec - District name
 * @param {Array<{id: string, name: string}>} nikData.kelurahan - List of villages for this district
 * @param {string} address - Street address from data
 * @param {Object} options - Geocoding options
 * @returns {Promise<{name: string, id: string, result: Object, geocoded: Object|null, source: string}|null>} Matched kelurahan with result
 */
export async function findExactKelurahanFromAddress(nikData, address, options = {}) {
  if (!nikData || !address) {
    return null;
  }

  const { nik, provinsi, kotakab, namaKec, kelurahan } = nikData;
  const [, namaKotakab] = kotakab.split(' ');

  // Build geocoding keyword from address and location data
  const keyword = `${address} ${namaKec}, ${namaKotakab}, ${provinsi}`.trim();

  try {
    // Geocode the address
    const geocoded = await getStreetAddressInformation(keyword, options);

    // Helper to normalize kelurahan names (remove spaces, lowercase)
    const normalizeKelurahan = (str) => str.toLowerCase().replace(/\s+/g, '').trim();

    let exactMatch = null;

    // Strategy 1: Match geocoded kelurahan with fuzzy matching
    if (geocoded?.kelurahan) {
      const geocodedNormalized = normalizeKelurahan(geocoded.kelurahan);
      exactMatch = kelurahan.find((k) => normalizeKelurahan(k.name) === geocodedNormalized);

      if (exactMatch) {
        return {
          name: exactMatch.name,
          id: exactMatch.id,
          result: {
            nik,
            provinsi,
            kotakab,
            kecamatan: namaKec,
            kelurahan: exactMatch.name,
            alamat: address
          },
          geocoded: {
            kelurahan: geocoded.kelurahan,
            kecamatan: geocoded.kecamatan,
            kota: geocoded.kota,
            provinsi: geocoded.provinsi,
            fullAddress: geocoded.fullAddress,
            provider: geocoded.provider
          },
          source: 'geocoder'
        };
      }
    }

    // Strategy 2: Fallback - search address for kelurahan matches
    const addressUpperCase = address.toUpperCase();
    exactMatch = kelurahan.find((k) => {
      const kelurahanUpper = k.name.toUpperCase();
      return (
        addressUpperCase.includes(kelurahanUpper) ||
        normalizeKelurahan(addressUpperCase).includes(normalizeKelurahan(kelurahanUpper))
      );
    });

    if (exactMatch) {
      return {
        name: exactMatch.name,
        id: exactMatch.id,
        result: {
          nik,
          provinsi,
          kotakab,
          kecamatan: namaKec,
          kelurahan: exactMatch.name,
          alamat: address
        },
        geocoded: geocoded,
        source: 'address'
      };
    }

    // No match found - fallback to first kelurahan from NIK district
    const fallbackKelurahan = Array.isArray(kelurahan) && kelurahan.length > 0 ? kelurahan[0] : null;

    if (fallbackKelurahan) {
      return {
        name: fallbackKelurahan.name,
        id: fallbackKelurahan.id,
        result: {
          nik,
          provinsi,
          kotakab,
          kecamatan: namaKec,
          kelurahan: fallbackKelurahan.name,
          alamat: address
        },
        geocoded: geocoded,
        source: 'nik-fallback',
        available: kelurahan
      };
    }

    // No kelurahan data available at all
    return {
      name: null,
      id: null,
      result: {
        nik,
        provinsi,
        kotakab,
        kecamatan: namaKec,
        kelurahan: null,
        alamat: address
      },
      geocoded: geocoded,
      source: 'none',
      available: kelurahan
    };
  } catch (error) {
    // Error during geocoding - fallback to first kelurahan from NIK district
    const fallbackKelurahan = Array.isArray(kelurahan) && kelurahan.length > 0 ? kelurahan[0] : null;

    if (fallbackKelurahan) {
      return {
        name: fallbackKelurahan.name,
        id: fallbackKelurahan.id,
        result: {
          nik,
          provinsi,
          kotakab,
          kecamatan: namaKec,
          kelurahan: fallbackKelurahan.name,
          alamat: address
        },
        geocoded: null,
        source: 'nik-fallback',
        error: error.message,
        available: kelurahan
      };
    }

    return {
      name: null,
      id: null,
      result: {
        nik,
        provinsi,
        kotakab,
        kecamatan: namaKec,
        kelurahan: null,
        alamat: address
      },
      geocoded: null,
      source: 'none',
      error: error.message,
      available: kelurahan
    };
  }
}
