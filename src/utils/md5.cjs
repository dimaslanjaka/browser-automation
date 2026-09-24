'use strict';

var CryptoJS = require('crypto-js');

function md5(str) {
    return CryptoJS.MD5(String(str)).toString(CryptoJS.enc.Hex);
}

module.exports = md5;
