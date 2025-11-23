import axios from 'axios';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { axiosConfigBuilder, getCacheFilePath } from './utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Geocodes an address using the Nominatim (OpenStreetMap) search API with caching and proxy support.
 *
 * Behaviour:
 * - Validates `keyword` and throws TypeError when invalid.
 * - Reads cached result from `.cache/address` unless `options.noCache` is true.
 * - Always writes successful results to cache (used for subsequent calls).
 * - Returns `null` when no result is found or on network/error.
 *
 * @param {string} keyword - The address or place name to search for.
 * @param {object} [options] - Optional settings.
 * @param {string} [options.proxy] - Proxy URL. Supported formats:
 *   - socks5://host:port
 *   - socks4://host:port
 *   - http://host:port
 *   - https://host:port
 * @param {boolean} [options.noCache=false] - When true, skip reading cache before the request (cache is still written).
 * @returns {Promise<import('./type').GeocodeResult|null>} - A geocoded result object or `null` if not found.
 *
 * Result object fields (may be `null` when not available):
 * - `keyword` (string): original search keyword.
 * - `fullAddress` / `display_name` (string): human readable address returned by Nominatim.
 * - `lat`, `lon` (string|null): original string latitude/longitude returned by Nominatim (backwards-compatible).
 * - `latitude`, `longitude` (number|null): normalized numeric coordinates when available.
 * - `googleMapsUrl` (string|null): quick link to the coordinates on Google Maps.
 * - `address` (object|null): structured OSM address details when returned.
 * - `osm_type`, `osm_id` (string|number|null): OSM identifiers when present.
 * - `geojson` (object|null): geojson geometry when returned by Nominatim.
 * - `polygon_kml` (string|null): polygon KML when returned by Nominatim.
 */
export async function geocodeWithNominatim(keyword, options = {}) {
  if (!keyword || typeof keyword !== 'string') {
    throw new TypeError('Keyword must be a non-empty string');
  }
  const cacheFile = getCacheFilePath(keyword);

  try {
    // Use cache if exists (unless noCache option is set)
    if (!options.noCache) {
      const cached = await fs.readFile(cacheFile, 'utf-8').catch(() => null);
      if (cached) return JSON.parse(cached);
    }
  } catch {
    // fall through on cache read error
  }

  const baseURL = 'https://nominatim.openstreetmap.org/search';

  const params = {
    q: keyword,
    format: 'json',
    addressdetails: 1,
    polygon_kml: 1, // request polygon KML when available
    limit: 1
  };

  try {
    // Nominatim search endpoint: always use GET
    const response = await axios.get(baseURL, { ...(await axiosConfigBuilder(options)), params });

    const data = response.data?.[0];
    if (!data) return null;

    // Ensure numeric coordinates when possible
    const lat = data.lat ? Number(data.lat) : null;
    const lon = data.lon ? Number(data.lon) : null;

    const result = {
      keyword,
      fullAddress: data.display_name,
      // backward-compatible fields (original tests expect these)
      display_name: data.display_name,
      lat: data.lat || (lat !== null ? String(lat) : null),
      lon: data.lon || (lon !== null ? String(lon) : null),
      // newer, normalized fields
      latitude: lat,
      longitude: lon,
      googleMapsUrl: lat && lon ? `https://www.google.com/maps?q=${lat},${lon}` : null,
      address: data.address || null,
      osm_type: data.osm_type || null,
      osm_id: data.osm_id || null,
      // Nominatim can return geojson or polygon_kml; include both if present
      geojson: data.geojson || null,
      polygon_kml: data.polygon_kml || null
    };

    // Write to cache
    await fs.writeFile(cacheFile, JSON.stringify(result, null, 2), 'utf-8');

    // Delay 1 second to respect Nominatim usage policy
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return result;
  } catch (error) {
    console.error('Nominatim Error:', error.message);
    return null;
  }
}

// CLI test
if (process.argv[1].includes('nominatim.js')) {
  (async () => {
    const addresses = [
      { keyword: 'TEMBOK GEDE I/51-H SURABAYA' },
      { keyword: 'LEBAK REJO UTARA 1/8 SURABAYA' },
      { keyword: 'KAPAS GADING MADYA 3D/2' }
    ];

    for (const { keyword } of addresses) {
      try {
        const result = await geocodeWithNominatim(keyword);
        console.log(result);
      } catch (error) {
        console.error(`Error geocoding "${keyword}":`, error);
      }
    }
  })();
}
