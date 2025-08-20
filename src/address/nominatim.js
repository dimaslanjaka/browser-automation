import axios from 'axios';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import pkg from '../../package.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.join(process.cwd(), '.cache', 'address');

/**
 * Hash a keyword using MD5
 * @param {string} keyword
 * @returns {string}
 */
function hashKeyword(keyword) {
  return crypto.createHash('md5').update(keyword).digest('hex');
}

/**
 * Get cache file path for a keyword
 * @param {string} keyword
 * @returns {string}
 */
function getCacheFilePath(keyword) {
  return path.join(CACHE_DIR, `${hashKeyword(keyword)}.json`);
}

/**
 * Geocodes an address using the Nominatim (OpenStreetMap) API with caching and proxy support.
 *
 * @param {string} keyword - The address or place name to search for.
 * @param {'GET'|'POST'} [method='GET'] - HTTP method to use (GET or POST).
 * @param {object} [options] - Optional settings.
 * @param {string} [options.proxy] - Proxy URL. Supported formats:
 *   - socks5://host:port
 *   - socks4://host:port
 *   - http://host:port
 *   - https://host:port
 * @returns {Promise<import('./type').GeocodeResult|null>} - A geocoded result or null if not found.
 */
export async function geocodeWithNominatim(keyword, method = 'GET', options = {}) {
  if (!keyword || typeof keyword !== 'string') {
    throw new TypeError('Keyword must be a non-empty string');
  }
  const cacheFile = getCacheFilePath(keyword);

  try {
    // Use cache if exists
    const cached = await fs.readFile(cacheFile, 'utf-8').catch(() => null);
    if (cached) return JSON.parse(cached);
  } catch {
    // fall through on cache read error
  }

  const baseURL = 'https://nominatim.openstreetmap.org/search';
  const headers = { 'User-Agent': `${pkg.name}/${pkg.version}` };

  const params = {
    q: keyword,
    format: 'json',
    addressdetails: 1,
    limit: 1
  };

  // Proxy support
  let axiosConfig = { headers };
  if (options.proxy) {
    // Dynamically require proxy agent packages only if needed
    let proxyUrl = options.proxy;
    let agent;
    if (/^socks5:/i.test(proxyUrl) || /^socks4:/i.test(proxyUrl)) {
      // socks-proxy-agent supports both socks4 and socks5
      const { SocksProxyAgent } = await import('socks-proxy-agent');
      agent = new SocksProxyAgent(proxyUrl);
    } else if (/^http:/i.test(proxyUrl) || /^https:/i.test(proxyUrl)) {
      const { HttpsProxyAgent } = await import('https-proxy-agent');
      agent = new HttpsProxyAgent(proxyUrl);
    }
    if (agent) {
      axiosConfig = {
        ...axiosConfig,
        httpAgent: agent,
        httpsAgent: agent,
        proxy: false // disable axios's default proxy handling
      };
    }
  }

  try {
    const response =
      method === 'POST'
        ? await axios.post(baseURL, new URLSearchParams(params), axiosConfig)
        : await axios.get(baseURL, { ...axiosConfig, params });

    const data = response.data?.[0];
    if (!data) return null;

    const result = {
      keyword,
      fullAddress: data.display_name,
      latitude: data.lat,
      longitude: data.lon,
      googleMapsUrl: `https://www.google.com/maps?q=${data.lat},${data.lon}`,
      address: data.address
    };

    // Write to cache
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(cacheFile, JSON.stringify(result, null, 2), 'utf-8');

    return result;
  } catch (error) {
    console.error('Nominatim Error:', error.message);
    return null;
  }
}

// CLI test
if (process.argv[1].includes('nominatim')) {
  (async () => {
    const addresses = [
      { keyword: 'TEMBOK GEDE I/51-H SURABAYA', method: 'GET' },
      { keyword: 'LEBAK REJO UTARA 1/8 SURABAYA', method: 'GET' },
      { keyword: 'KAPAS GADING MADYA 3D/2' }
    ];

    for (const { keyword, method = 'GET' } of addresses) {
      try {
        const result = await geocodeWithNominatim(keyword, method);
        console.log(result);
      } catch (error) {
        console.error(`Error geocoding "${keyword}":`, error);
      }
    }
  })();
}
