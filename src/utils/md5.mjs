import CryptoJS from 'crypto-js';

function md5(str) {
    return CryptoJS.MD5(String(str)).toString(CryptoJS.enc.Hex);
}

export { md5 as default };
