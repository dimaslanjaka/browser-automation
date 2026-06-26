import { pickValue } from './pickValue.js';

/**
 * Normalize province name to Indonesian standard format.
 * @param {string} name - Province name to normalize.
 * @returns {string} Normalized province name.
 */
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

/**
 * Normalize street address information from geocoding result.
 * @param {Object} result - The geocoding result object.
 * @param {string} provider - The geocoding provider name.
 * @returns {import('./type.js').StreetAddressInfo} Normalized street address information.
 */
export function normalizeStreetAddressInfo(result, provider) {
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
