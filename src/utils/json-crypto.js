// json-crypto.js
// Utility for encrypting and decrypting JSON data using AES
// Works in both Node.js and browser environments

// For browser: use crypto-js
// For Node.js: use built-in crypto

import CryptoJS from 'crypto-js';
import crypto from 'crypto';

/**
 * Encrypt a JSON object to a string
 * @param {Object} data - The JSON data to encrypt
 * @param {string} secret - The encryption key
 * @returns {string} Encrypted string
 */
export function encryptJson(data, secret) {
  const jsonString = JSON.stringify(data);
  if (typeof window !== 'undefined') {
    // Browser: use CryptoJS
    return CryptoJS.AES.encrypt(jsonString, secret).toString();
  } else {
    // Node.js: use crypto
    const iv = crypto.randomBytes(16);
    const key = crypto.createHash('sha256').update(secret).digest();
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    let encrypted = cipher.update(jsonString, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    return iv.toString('base64') + ':' + encrypted;
  }
}

/**
 * Decrypt an encrypted JSON string
 * @param {string} encrypted - The encrypted string
 * @param {string} secret - The encryption key
 * @returns {Object} Decrypted JSON object
 */
export function decryptJson(encrypted, secret) {
  if (typeof window !== 'undefined') {
    // Browser: use CryptoJS
    const bytes = CryptoJS.AES.decrypt(encrypted, secret);
    const jsonString = bytes.toString(CryptoJS.enc.Utf8);
    return JSON.parse(jsonString);
  } else {
    // Node.js: use crypto
    const [ivBase64, encryptedData] = encrypted.split(':');
    const iv = Buffer.from(ivBase64, 'base64');
    const key = crypto.createHash('sha256').update(secret).digest();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  }
}

// NodeJS example usage:
// const secret = process.env.JSON_SECRET; // from .env
// const encrypted = encryptJson({ foo: 'bar' }, secret);
// const decrypted = decryptJson(encrypted, secret);

// Vite example usage:
// const secret = import.meta.env.VITE_JSON_SECRET;
// const encrypted = encryptJson({ foo: 'bar' }, secret);
// const decrypted = decryptJson(encrypted, secret);
