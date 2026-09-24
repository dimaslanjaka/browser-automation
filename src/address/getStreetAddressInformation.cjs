'use strict';

var require$$4 = require('sbg-utility');
var geoapify = require('./geoapify.cjs');
var nominatim = require('./nominatim.cjs');
var normalizeStreetAddressInfo = require('./normalizeStreetAddressInfo.cjs');

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
    const nominatimResult = await nominatim.geocodeWithNominatim(keyword, options);
    if (nominatimResult) {
        return normalizeStreetAddressInfo.normalizeStreetAddressInfo(nominatimResult, 'nominatim');
    }
    const geoapifyApiKey = require$$4.array_random(geoapify.getGeoapifyKeys());
    const geoapifyResult = await geoapify.geoCodeWithGeoapify(keyword, geoapifyApiKey, options);
    if (geoapifyResult) {
        return normalizeStreetAddressInfo.normalizeStreetAddressInfo(geoapifyResult, 'geoapify');
    }
    return null;
}

exports.getStreetAddressInformation = getStreetAddressInformation;
