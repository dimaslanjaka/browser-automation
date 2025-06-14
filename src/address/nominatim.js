import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from '../../package.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Geocodes an address using the Nominatim (OpenStreetMap) API.
 *
 * @param {string} keyword - The address or place name to search for.
 * @param {'GET'|'POST'} [method='GET'] - HTTP method to use (GET or POST).
 * @returns {Promise<{
 *   keyword: string,
 *   fullAddress: string,
 *   latitude: string,
 *   longitude: string,
 *   googleMapsUrl: string,
 *   address: object
 * } | null>} - A promise that resolves to a geocoded object or null if not found.
 */
export async function geocodeWithNominatim(keyword, method = 'GET') {
  const baseURL = 'https://nominatim.openstreetmap.org/search';
  const headers = { 'User-Agent': `${pkg.name}/${pkg.version}` };

  const params = {
    q: keyword,
    format: 'json',
    addressdetails: 1,
    limit: 1
  };

  try {
    const response =
      method === 'POST'
        ? await axios.post(baseURL, new URLSearchParams(params), { headers })
        : await axios.get(baseURL, { params, headers });

    const data = response.data?.[0];
    if (!data) return null;

    const { lat, lon } = data;

    return {
      keyword,
      fullAddress: data.display_name,
      latitude: lat,
      longitude: lon,
      googleMapsUrl: `https://www.google.com/maps?q=${lat},${lon}`,
      address: data.address
    };
  } catch (error) {
    console.error('Nominatim Error:', error.message);
    return null;
  }
}

// CLI test
if (process.argv[1] === __filename) {
  (async () => {
    const result = await geocodeWithNominatim('TEMBOK GEDE I/51-H SURABAYA', 'GET');
    console.log(result);
  })();
}
