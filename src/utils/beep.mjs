import 'axios';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import 'stream/promises';
import { promisify } from 'util';
import 'node-7z';
import 'glob';
import '7zip-bin';

promisify(exec);
os.platform() === 'win32';
const cacheDir = path.join(process.cwd(), '.cache');
fs.mkdirSync(cacheDir, { recursive: true });
path.join(cacheDir, 'ffmpeg');
function singleBeep() {
    exec('[console]::beep(1000, 500)', { shell: 'powershell.exe' });
}
function multiBeep() {
    exec('1..3 | %{ [console]::beep(1000, 500) }', { shell: 'powershell.exe' });
}

export { multiBeep, singleBeep };
