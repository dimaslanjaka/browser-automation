// json-crypto.js
// Utility for encrypting and decrypting JSON data using AES
// Works in both Node.js and browser environments

// For browser: use crypto-js
// For Node.js: use built-in crypto

// Use CryptoJS for both Node.js and browser
import CryptoJS from 'crypto-js';

// JSON stringify/parse with circular reference support
// Circular reference-safe JSON stringify/parse (flatted-like)
function jsonStringifyWithCircularRefsBrowser(obj) {
  const objects = new Map();
  const paths = new Map();
  let nextId = 1;

  function replacer(key, value) {
    if (typeof value === 'object' && value !== null) {
      if (objects.has(value)) {
        return { $ref: paths.get(value) };
      }
      const path = paths.size === 0 ? '$' : paths.get(this) + (Array.isArray(this) ? `[${key}]` : `.${key}`);
      objects.set(value, nextId++);
      paths.set(value, path);
    }
    return value;
  }
  return JSON.stringify(obj, replacer);
}

function jsonParseWithCircularRefsBrowser(str) {
  const refs = [];
  const obj = JSON.parse(str, function (key, value) {
    if (value && typeof value === 'object' && value.$ref) {
      refs.push({ holder: this, key, ref: value.$ref });
      return undefined;
    }
    return value;
  });
  refs.forEach(({ holder, key, ref }) => {
    let path = ref.split('.').reduce((acc, part) => {
      if (part === '$') return acc;
      if (part.endsWith(']')) {
        // Array index
        const [arrKey, idx] = part.match(/(\w+)\[(\d+)\]/).slice(1);
        return acc[arrKey][parseInt(idx, 10)];
      }
      return acc[part];
    }, obj);
    holder[key] = path;
  });
  return obj;
}

export function encryptJson(data, secret) {
  const jsonString = jsonStringifyWithCircularRefsBrowser(data);
  // Use CryptoJS AES for both Node.js and browser
  return CryptoJS.AES.encrypt(jsonString, secret).toString();
}

/**
 * Decrypt an encrypted JSON string
 * @param {string} encrypted - The encrypted string
 * @param {string} secret - The encryption key
 * @returns {Object} Decrypted JSON object
 */

export function decryptJson(encrypted, secret) {
  // Use CryptoJS AES for both Node.js and browser
  const bytes = CryptoJS.AES.decrypt(encrypted, secret);
  const jsonString = bytes.toString(CryptoJS.enc.Utf8);
  return jsonParseWithCircularRefsBrowser(jsonString);
}

// NodeJS example usage:
// const secret = process.env.JSON_SECRET; // from .env
// const encrypted = encryptJson({ foo: 'bar' }, secret);
// const decrypted = decryptJson(encrypted, secret);

// Vite example usage:
// const secret = import.meta.env.VITE_JSON_SECRET;
// const encrypted = encryptJson({ foo: 'bar' }, secret);
// const decrypted = decryptJson(encrypted, secret);
