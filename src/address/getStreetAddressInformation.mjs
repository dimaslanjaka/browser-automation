import { array_random } from 'sbg-utility';
import { getGeoapifyKeys, geoCodeWithGeoapify } from './geoapify.mjs';
import { geocodeWithNominatim } from './nominatim.mjs';
import { normalizeStreetAddressInfo } from './normalizeStreetAddressInfo.mjs';

/**
 * Get normalized street address information.
 * Provider order: Nominatim first, then Geoapify fallback when Nominatim has no result.
 *
 * @param {string} keyword - The street address query.
 * @param {import('./type.js').GeocodeOptions} options - Additional options for the geocoding request.
 * @returns {Promise<import('./type.js').StreetAddressInfo|null>} - Normalized street address information.
 */
async function getStreetAddressInformation(keyword, options = {}) {
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

export { getStreetAddressInformation };
