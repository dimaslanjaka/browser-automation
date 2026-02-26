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
  const provinsi = pickValue(address.state, address.province, address.region);
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
    const keyword = 'Jl. Lebak Arum Barat 82-84 Kota Surabaya, Jawa Timur';
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
