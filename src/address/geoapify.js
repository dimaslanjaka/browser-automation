import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { writefile, isEmpty } from 'sbg-utility';
import { axiosConfigBuilder, getCacheFilePath } from './utils.js';

/**
 * Geocode a keyword using the Geoapify API with caching support
 * @param {string} keyword The location/address string to geocode
 * @param {string} apiKey Geoapify API key for authentication
 * @param {import('./type.js').GeocodeOptions} [options] Configuration options
 * @returns {Promise<import('./type.js').GeocodeResult|null>} Geocoding results or null on error
 */
export async function geoCodeWithGeoapify(keyword, apiKey, options = {}) {
  if (!keyword || typeof keyword !== 'string') {
    throw new TypeError('Keyword must be a non-empty string');
  }
  const cacheFile = getCacheFilePath(keyword);
  const verbose = options.verbose || false;

  try {
    // Use cache if exists (unless noCache option is set)
    if (!options.noCache) {
      const cached = await fs.readFile(cacheFile, 'utf-8').catch(() => null);
      if (cached) {
        if (verbose) console.log('Geoapify cache hit:', cacheFile);
        return JSON.parse(cached);
      } else {
        if (verbose) console.log('Geoapify cache miss:', cacheFile);
      }
    } else {
      if (verbose) console.log('Geoapify noCache option set, bypassing cache');
    }
  } catch {
    // fall through on cache read error
  }

  const baseUrl = 'https://api.geoapify.com/v1/geocode/search';
  const url = new URL(baseUrl);
  url.searchParams.append('text', keyword);
  url.searchParams.append('apiKey', apiKey);

  try {
    const response = await axios.get(url.toString(), { ...(await axiosConfigBuilder(options)) });
    const data = response.data;
    if (isEmpty(data) || isEmpty(data.features, { allowWhitespace: true })) {
      if (verbose) console.log('Geoapify no results for keyword:', keyword);
      return null;
    }
    const props = data.features[0]?.properties || {};
    if (response.status === 200) {
      writefile(cacheFile, response.data);
      if (verbose) console.log('Geoapify response cached:', cacheFile);
    }

    // Build full address from components
    const addressParts = [];
    if (props.housenumber) addressParts.push(props.housenumber);
    if (props.street) addressParts.push(props.street);
    if (props.suburb) addressParts.push(props.suburb);
    if (props.city) addressParts.push(props.city);
    if (props.postcode) addressParts.push(props.postcode);
    if (props.country) addressParts.push(props.country);

    let fullAddress = props.formatted;
    if (isEmpty(fullAddress)) {
      fullAddress = addressParts.join(', ');
    }

    const longitude = data.features[0]?.geometry?.coordinates[0] || props.lon || null;
    const latitude = data.features[0]?.geometry?.coordinates[1] || props.lat || null;

    /** @type {import('./type.js').GeocodeResult} */
    const result = {
      keyword,
      fullAddress: fullAddress || '',
      display_name: fullAddress || '',
      lat: latitude || '',
      lon: longitude || '',
      latitude: latitude || '',
      longitude: longitude || '',
      googleMapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(keyword)}`,
      address: props
    };

    // Delay 1s between requests to respect rate limits
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return result;
  } catch (e) {
    console.error('Geoapify error:', e);
    return null;
  }
}

export function getGeoapifyKeys() {
  return (process.env.GEOAPIFY_KEYS || '')
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

if (process.argv[1].includes('geoapify.js')) {
  (async function () {
    (await import('dotenv')).config({ override: true, path: path.join(process.cwd(), '.env') });
    const apiKey = getGeoapifyKeys()[0];
    const keyword = 'LEBAK REJO UTARA 1/8 SURABAYA';
    const result = await geoCodeWithGeoapify(keyword, apiKey, { verbose: true, noCache: true });
    console.log(result);
  })();
}
