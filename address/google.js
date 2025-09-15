import '../chunk-BUSYA2B4.js';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from '../../package.json';

const __filename = fileURLToPath(import.meta.url);
path.dirname(__filename);
async function geocodeWithGoogle(keyword, apiKey) {
  const query = encodeURIComponent(keyword);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}`;
  try {
    const { data } = await axios.get(url, {
      headers: { "User-Agent": `${pkg.name}/${pkg.version}` }
    });
    if (data.status !== "OK") {
      console.error("Google Geocoding Error:", data.status);
      return null;
    }
    if (!data.results || data.results.length === 0) {
      console.error("No results found for:", keyword);
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
    console.error("Google Geocoding Error:", error.message);
    return null;
  }
}
if (process.argv[1].includes("address/google")) {
  (async () => {
    const keyword = "1600 Amphitheatre Parkway, Mountain View, CA";
    const apiKey = "YOUR_API_KEY_HERE";
    const result = await geocodeWithGoogle(keyword, apiKey);
    console.log(result);
  })();
}

export { geocodeWithGoogle };
//# sourceMappingURL=google.js.map
//# sourceMappingURL=google.js.map