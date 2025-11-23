import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs-extra';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_DIR = path.join(process.cwd(), '.cache', 'address');
fs.mkdirSync(CACHE_DIR, { recursive: true });

/**
 * Hash a keyword using MD5
 * @param {string} keyword
 * @returns {string}
 */
export function encryptKeyword(keyword) {
  return crypto.createHash('md5').update(keyword).digest('hex');
}

/**
 * Get cache file path for a keyword
 * @param {string} keyword
 * @returns {string}
 */
export function getCacheFilePath(keyword) {
  return path.join(CACHE_DIR, `${encryptKeyword(keyword)}.json`);
}

/**
 * Build axios configuration with optional proxy support
 * @param {Object} options Configuration options
 * @param {string} [options.proxy] Optional proxy URL (socks4, socks5, http, or https)
 * @returns {Promise<Object>} Axios configuration object with headers and optional proxy agents
 */
export async function axiosConfigBuilder(options = {}) {
  const headers = { 'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:145.0) Gecko/20100101 Firefox/145.0` };
  let axiosConfig = { headers };

  // Proxy support
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

  return axiosConfig;
}
