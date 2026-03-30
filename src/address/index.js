import { array_random } from 'sbg-utility';
import { geoCodeWithGeoapify, getGeoapifyKeys } from './geoapify.js';
import { geocodeWithNominatim } from './nominatim.js';
import path from 'upath';

function pickValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return null;
}

function normalizeStreetAddressInfo(result, provider) {
  const address = result?.address || {};

  const kelurahan = pickValue(address.village, address.suburb, address.neighbourhood, address.quarter, address.hamlet);
  const kecamatan = pickValue(
    address.city_district,
    address.subdistrict,
    address.district,
    address.county,
    address.municipality
  );
  const kota = pickValue(address.city, address.town);
  const kabupaten = pickValue(address.regency, address.county, address.state_district);
  let provinsi = pickValue(address.state, address.province, address.region);

  // Normalize common English/alternate province names to Indonesian names
  function normalizeProvince(name) {
    if (!name) return name;
    const n = String(name).toLowerCase().trim();
    const map = new Map([
      ['east java', 'Jawa Timur'],
      ['jawa timur', 'Jawa Timur'],
      ['jawa tim.', 'Jawa Timur'],
      ['belitung', 'Kepulauan Bangka Belitung'],
      ['bangka belitung', 'Kepulauan Bangka Belitung'],
      ['kepulauan bangka belitung', 'Kepulauan Bangka Belitung'],
      ['central java', 'Jawa Tengah'],
      ['middle java', 'Jawa Tengah'],
      ['jawa tengah', 'Jawa Tengah'],
      ['west java', 'Jawa Barat'],
      ['jawa barat', 'Jawa Barat'],
      ['special region of yogyakarta', 'DI Yogyakarta'],
      ['yogyakarta', 'DI Yogyakarta'],
      ['dki jakarta', 'DKI Jakarta'],
      ['jakarta', 'DKI Jakarta']
    ]);

    // Try exact known mappings first
    if (map.has(n)) return map.get(n);

    // Try to match keywords (e.g., "east java", "central java")
    if (n.includes('east java') || n.includes('jawa timur')) return 'Jawa Timur';
    if (n.includes('central java') || n.includes('middle java') || n.includes('jawa tengah')) return 'Jawa Tengah';
    if (n.includes('west java') || n.includes('jawa barat')) return 'Jawa Barat';
    if (n.includes('bangka') || n.includes('belitung') || n.includes('kepulauan bangka'))
      return 'Kepulauan Bangka Belitung';
    if (n.includes('yogyakarta')) return 'DI Yogyakarta';
    if (n.includes('jakarta')) return 'DKI Jakarta';

    // Fallback: title-case the original value
    return String(name)
      .toLowerCase()
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  provinsi = normalizeProvince(provinsi);
  const country = pickValue(address.country);

  return {
    keyword: result?.keyword || null,
    provider,
    fullAddress: result?.fullAddress || result?.display_name || '',
    kelurahan,
    kecamatan,
    kota: kota || kabupaten,
    kabupaten,
    provinsi,
    country,
    latitude: pickValue(result?.latitude, result?.lat),
    longitude: pickValue(result?.longitude, result?.lon),
    raw: result || null
  };
}

/**
 * Geocode an address using multiple providers.
 * @param {string} keyword - The address or location to geocode.
 * @param {import('./type.js').GeocodeOptions} options - Additional options for the geocoding request.
 * @returns {Promise<import('./type.js').GeocodeResult|null>} - The geocoding result or null if not found.
 */
export default async function geoCodeAddress(keyword, options = {}) {
  const geoapifyApiKey = array_random(getGeoapifyKeys());
  const geoapifyResult = await geoCodeWithGeoapify(keyword, geoapifyApiKey, options);
  if (!geoapifyResult) {
    const nominatimResult = await geocodeWithNominatim(keyword, options);
    return nominatimResult;
  }
  return geoapifyResult;
}

/**
 * Get normalized street address information.
 * Provider order: Nominatim first, then Geoapify fallback when Nominatim has no result.
 *
 * @param {string} keyword - The street address query.
 * @param {import('./type.js').GeocodeOptions} options - Additional options for the geocoding request.
 * @returns {Promise<import('./type.js').StreetAddressInfo|null>} - Normalized street address information.
 */
export async function getStreetAddressInformation(keyword, options = {}) {
  if (!keyword || typeof keyword !== 'string') {
    throw new TypeError('Keyword must be a non-empty string');
  }

  const nominatimResult = await geocodeWithNominatim(keyword, options);
  if (nominatimResult) {
    return normalizeStreetAddressInfo(nominatimResult, 'nominatim');
  }

  const geoapifyApiKey = array_random(getGeoapifyKeys());
  const geoapifyResult = await geoCodeWithGeoapify(keyword, geoapifyApiKey, options);
  if (geoapifyResult) {
    return normalizeStreetAddressInfo(geoapifyResult, 'geoapify');
  }

  return null;
}

// CLI test
const fileArgv = path.resolve(process.argv[1]);
if (fileArgv.endsWith('src/address/index.js')) {
  (async () => {
    const keyword = 'DUKUH SETRO 12 NO 5 A Surabaya, Jawa Timur';
    const result = await getStreetAddressInformation(keyword, { verbose: true, noCache: true });
    if (result) {
      console.log('Street address information:');
      console.log({
        kelurahan: result.kelurahan,
        kecamatan: result.kecamatan,
        kota: result.kota,
        kabupaten: result.kabupaten,
        provinsi: result.provinsi,
        country: result.country,
        provider: result.provider,
        fullAddress: result.fullAddress,
        latitude: result.latitude,
        longitude: result.longitude
      });
    } else {
      console.log('No street address information found for keyword:', keyword);
    }
  })();
}
