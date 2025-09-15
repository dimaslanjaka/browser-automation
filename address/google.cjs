'use strict';

require('../chunk-4IBVXDKH.cjs');
var axios = require('axios');
var path = require('path');
var url = require('url');
var pkg = require('../../package.json');

var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var axios__default = /*#__PURE__*/_interopDefault(axios);
var path__default = /*#__PURE__*/_interopDefault(path);
var pkg__default = /*#__PURE__*/_interopDefault(pkg);

const __filename$1 = url.fileURLToPath((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('google.cjs', document.baseURI).href)));
path__default.default.dirname(__filename$1);
async function geocodeWithGoogle(keyword, apiKey) {
  const query = encodeURIComponent(keyword);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${apiKey}`;
  try {
    const { data } = await axios__default.default.get(url, {
      headers: { "User-Agent": `${pkg__default.default.name}/${pkg__default.default.version}` }
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

exports.geocodeWithGoogle = geocodeWithGoogle;
//# sourceMappingURL=google.cjs.map
//# sourceMappingURL=google.cjs.map