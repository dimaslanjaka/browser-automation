'use strict';

require('../chunk-4IBVXDKH.cjs');
var axios = require('axios');
var crypto = require('crypto');
var fs = require('fs/promises');
var path = require('path');
var url = require('url');
var pkg = require('../../package.json');

var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var axios__default = /*#__PURE__*/_interopDefault(axios);
var crypto__default = /*#__PURE__*/_interopDefault(crypto);
var fs__default = /*#__PURE__*/_interopDefault(fs);
var path__default = /*#__PURE__*/_interopDefault(path);
var pkg__default = /*#__PURE__*/_interopDefault(pkg);

const __filename$1 = url.fileURLToPath((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('nominatim.cjs', document.baseURI).href)));
path__default.default.dirname(__filename$1);
const CACHE_DIR = path__default.default.join(process.cwd(), ".cache", "address");
function hashKeyword(keyword) {
  return crypto__default.default.createHash("md5").update(keyword).digest("hex");
}
function getCacheFilePath(keyword) {
  return path__default.default.join(CACHE_DIR, `${hashKeyword(keyword)}.json`);
}
async function geocodeWithNominatim(keyword, method = "GET", options = {}) {
  var _a;
  if (!keyword || typeof keyword !== "string") {
    throw new TypeError("Keyword must be a non-empty string");
  }
  const cacheFile = getCacheFilePath(keyword);
  try {
    const cached = await fs__default.default.readFile(cacheFile, "utf-8").catch(() => null);
    if (cached) return JSON.parse(cached);
  } catch {
  }
  const baseURL = "https://nominatim.openstreetmap.org/search";
  const headers = { "User-Agent": `${pkg__default.default.name}/${pkg__default.default.version}` };
  const params = {
    q: keyword,
    format: "json",
    addressdetails: 1,
    limit: 1
  };
  let axiosConfig = { headers };
  if (options.proxy) {
    let proxyUrl = options.proxy;
    let agent;
    if (/^socks5:/i.test(proxyUrl) || /^socks4:/i.test(proxyUrl)) {
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
        proxy: false
        // disable axios's default proxy handling
      };
    }
  }
  try {
    const response = method === "POST" ? await axios__default.default.post(baseURL, new URLSearchParams(params), axiosConfig) : await axios__default.default.get(baseURL, { ...axiosConfig, params });
    const data = (_a = response.data) == null ? void 0 : _a[0];
    if (!data) return null;
    const result = {
      keyword,
      fullAddress: data.display_name,
      latitude: data.lat,
      longitude: data.lon,
      googleMapsUrl: `https://www.google.com/maps?q=${data.lat},${data.lon}`,
      address: data.address
    };
    await fs__default.default.mkdir(CACHE_DIR, { recursive: true });
    await fs__default.default.writeFile(cacheFile, JSON.stringify(result, null, 2), "utf-8");
    return result;
  } catch (error) {
    console.error("Nominatim Error:", error.message);
    return null;
  }
}
if (process.argv[1].includes("nominatim")) {
  (async () => {
    const addresses = [
      { keyword: "TEMBOK GEDE I/51-H SURABAYA", method: "GET" },
      { keyword: "LEBAK REJO UTARA 1/8 SURABAYA", method: "GET" },
      { keyword: "KAPAS GADING MADYA 3D/2" }
    ];
    for (const { keyword, method = "GET" } of addresses) {
      try {
        const result = await geocodeWithNominatim(keyword, method);
        console.log(result);
      } catch (error) {
        console.error(`Error geocoding "${keyword}":`, error);
      }
    }
  })();
}

exports.geocodeWithNominatim = geocodeWithNominatim;
//# sourceMappingURL=nominatim.cjs.map
//# sourceMappingURL=nominatim.cjs.map