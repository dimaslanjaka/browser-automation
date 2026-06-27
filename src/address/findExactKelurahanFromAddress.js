import { getStreetAddressInformation } from './getStreetAddressInformation.js';
import { normalizeAddressNameToIndonesian } from './normalizeAddressNameToIndonesian.js';

const normalizeAddressPart = (value) => normalizeAddressNameToIndonesian(value);

const normalizeKabupatenKota = (value) => {
  const normalized = normalizeAddressPart(value);
  return normalized.toLowerCase().includes('surabaya') ? 'Kota Surabaya' : normalized;
};

const normalizeGeocodedAddress = (geocoded) => {
  if (!geocoded) {
    return geocoded;
  }

  return {
    ...geocoded,
    provinsi: normalizeAddressPart(geocoded.provinsi),
    kabupaten: normalizeKabupatenKota(geocoded.kabupaten),
    kota: normalizeKabupatenKota(geocoded.kota),
    kecamatan: normalizeAddressPart(geocoded.kecamatan),
    kelurahan: normalizeAddressPart(geocoded.kelurahan)
  };
};

const createKelurahanResult = ({
  nik,
  provinsi,
  kotakab,
  namaKec,
  kelurahanName,
  address,
  geocoded,
  source,
  id,
  error,
  available
}) => {
  const normalizedKelurahan = kelurahanName ? normalizeAddressPart(kelurahanName) : null;
  const response = {
    name: normalizedKelurahan,
    id: id || null,
    result: {
      nik,
      provinsi: normalizeAddressPart(provinsi),
      kotakab: normalizeKabupatenKota(kotakab),
      kecamatan: normalizeAddressPart(namaKec),
      kelurahan: normalizedKelurahan,
      alamat: address
    },
    geocoded: normalizeGeocodedAddress(geocoded),
    source
  };

  if (error != null) {
    response.error = error;
  }

  if (available !== undefined) {
    response.available = available;
  }

  return response;
};

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
        return createKelurahanResult({
          nik,
          provinsi,
          kotakab,
          namaKec,
          kelurahanName: exactMatch.name,
          address,
          geocoded: {
            kelurahan: geocoded.kelurahan,
            kecamatan: geocoded.kecamatan,
            kota: geocoded.kota,
            provinsi: geocoded.provinsi,
            fullAddress: geocoded.fullAddress,
            provider: geocoded.provider
          },
          source: 'geocoder',
          id: exactMatch.id
        });
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
      return createKelurahanResult({
        nik,
        provinsi,
        kotakab,
        namaKec,
        kelurahanName: exactMatch.name,
        address,
        geocoded,
        source: 'address',
        id: exactMatch.id
      });
    }

    // No match found - fallback to first kelurahan from NIK district
    const fallbackKelurahan = Array.isArray(kelurahan) && kelurahan.length > 0 ? kelurahan[0] : null;

    if (fallbackKelurahan) {
      return createKelurahanResult({
        nik,
        provinsi,
        kotakab,
        namaKec,
        kelurahanName: fallbackKelurahan.name,
        address,
        geocoded,
        source: 'nik-fallback',
        id: fallbackKelurahan.id,
        available: kelurahan
      });
    }

    // No kelurahan data available at all
    return createKelurahanResult({
      nik,
      provinsi,
      kotakab,
      namaKec,
      kelurahanName: null,
      address,
      geocoded,
      source: 'none',
      available: kelurahan
    });
  } catch (error) {
    // Error during geocoding - fallback to first kelurahan from NIK district
    const fallbackKelurahan = Array.isArray(kelurahan) && kelurahan.length > 0 ? kelurahan[0] : null;

    if (fallbackKelurahan) {
      return createKelurahanResult({
        nik,
        provinsi,
        kotakab,
        namaKec,
        kelurahanName: fallbackKelurahan.name,
        address,
        geocoded: null,
        source: 'nik-fallback',
        id: fallbackKelurahan.id,
        error: error.message,
        available: kelurahan
      });
    }

    return createKelurahanResult({
      nik,
      provinsi,
      kotakab,
      namaKec,
      kelurahanName: null,
      address,
      geocoded: null,
      source: 'none',
      error: error.message,
      available: kelurahan
    });
  }
}
