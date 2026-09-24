'use strict';

require('axios');
var fs = require('fs-extra');
var path = require('path');
var os = require('os');
var require$$0 = require('child_process');
require('stream/promises');
var util = require('util');
require('node-7z');
require('glob');
require('7zip-bin');

util.promisify(require$$0.exec);
os.platform() === 'win32';
const cacheDir = path.join(process.cwd(), '.cache');
fs.mkdirSync(cacheDir, { recursive: true });
path.join(cacheDir, 'ffmpeg');
function singleBeep() {
    require$$0.exec('[console]::beep(1000, 500)', { shell: 'powershell.exe' });
}
function multiBeep() {
    require$$0.exec('1..3 | %{ [console]::beep(1000, 500) }', { shell: 'powershell.exe' });
}

exports.multiBeep = multiBeep;
exports.singleBeep = singleBeep;
