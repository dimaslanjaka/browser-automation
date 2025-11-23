import { array_random } from 'sbg-utility';
import { geoCodeWithGeoapify, getGeoapifyKeys } from './geoapify.js';
import { geocodeWithNominatim } from './nominatim.js';
import path from 'upath';

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

// CLI test
const fileArgv = path.join(process.argv[1]);
if (fileArgv.endsWith('src/address/index.js')) {
  (async () => {
    const keyword = '1600 Amphitheatre Parkway, Mountain View, CA';
    const result = await geoCodeAddress(keyword, { verbose: true, noCache: true });
    console.log('Geocode result:', result);
  })();
}
