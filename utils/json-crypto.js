import '../chunk-BUSYA2B4.js';
import CryptoJS from 'crypto-js';

function jsonStringifyWithCircularRefsBrowser(obj) {
  const objects = /* @__PURE__ */ new Map();
  const paths = /* @__PURE__ */ new Map();
  let nextId = 1;
  function replacer(key, value) {
    if (typeof value === "object" && value !== null) {
      if (objects.has(value)) {
        return { $ref: paths.get(value) };
      }
      const path = paths.size === 0 ? "$" : paths.get(this) + (Array.isArray(this) ? `[${key}]` : `.${key}`);
      objects.set(value, nextId++);
      paths.set(value, path);
    }
    return value;
  }
  return JSON.stringify(obj, replacer);
}
function jsonParseWithCircularRefsBrowser(str) {
  const refs = [];
  const obj = JSON.parse(str, function(key, value) {
    if (value && typeof value === "object" && value.$ref) {
      refs.push({ holder: this, key, ref: value.$ref });
      return void 0;
    }
    return value;
  });
  refs.forEach(({ holder, key, ref }) => {
    let path = ref.split(".").reduce((acc, part) => {
      if (part === "$") return acc;
      if (part.endsWith("]")) {
        const [arrKey, idx] = part.match(/(\w+)\[(\d+)\]/).slice(1);
        return acc[arrKey][parseInt(idx, 10)];
      }
      return acc[part];
    }, obj);
    holder[key] = path;
  });
  return obj;
}
function encryptJson(data, secret) {
  const jsonString = jsonStringifyWithCircularRefsBrowser(data);
  return CryptoJS.AES.encrypt(jsonString, secret).toString();
}
function decryptJson(encrypted, secret) {
  const bytes = CryptoJS.AES.decrypt(encrypted, secret);
  const jsonString = bytes.toString(CryptoJS.enc.Utf8);
  return jsonParseWithCircularRefsBrowser(jsonString);
}

export { decryptJson, encryptJson };
//# sourceMappingURL=json-crypto.js.map
//# sourceMappingURL=json-crypto.js.map