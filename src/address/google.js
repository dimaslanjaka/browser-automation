import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from '../../package.json' with { type: 'json' };

// Get the absolute path of the current script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Geocodes an address using the Google Maps Geocoding API.
 *
 * @param {string} keyword - The address or place name to search for.
 * @param {string} apiKey - Your Google Maps Geocoding API key.
 * @returns {Promise<{
 *   fullAddress: string,
 *   latitude: number,
 *   longitude: number
 * } | null>} - A promise that resolves to a geocoded object or null if not found.
 */
export async function geocodeWithGoogle(keyword, apiKey) {
  const query = encodeURIComponent(keyword);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}`;

  try {
    const { data } = await axios.get(url, {
      headers: { 'User-Agent': `${pkg.name}/${pkg.version}` }
    });
    if (data.status !== 'OK') {
      console.error('Google Geocoding Error:', data.status);
      return null;
    }
    if (!data.results || data.results.length === 0) {
      console.error('No results found for:', keyword);
      return null;
    }
    const result = data.results[0];
    if (!result) return null;

    return {
      fullAddress: result.formatted_address,
      latitude: result.geometry.location.lat,
      longitude: result.geometry.location.lng
    };
  } catch (error) {
    console.error('Google Geocoding Error:', error.message);
    return null;
  }
}

if (process.argv[1].includes('address/google')) {
  (async () => {
    // Example usage for testing
    const keyword = '1600 Amphitheatre Parkway, Mountain View, CA';
    const apiKey = 'YOUR_API_KEY_HERE';
    const result = await geocodeWithGoogle(keyword, apiKey);
    console.log(result);
  })();
}
