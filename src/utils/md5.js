import CryptoJS from 'crypto-js';

export default function md5(str) {
  return CryptoJS.MD5(String(str)).toString(CryptoJS.enc.Hex);
}
