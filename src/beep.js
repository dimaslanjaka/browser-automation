import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { mkdirSync } from 'fs';
import { spawn } from 'child_process';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';
import node7z from 'node-7z';
import * as glob from 'glob';
import { path7za } from '7zip-bin';

const execAsync = promisify(exec);
const isWindows = os.platform() === 'win32';

const cacheDir = path.join(process.cwd(), '.cache');
mkdirSync(cacheDir, { recursive: true });

const extractDir = path.join(cacheDir, 'ffmpeg');
const archivePath = path.join(cacheDir, isWindows ? 'ffmpeg.7z' : 'ffmpeg.tar.xz');

/**
 * Get the appropriate FFmpeg download URL based on the current platform and architecture.
 *
 * @returns {string} - The URL to download the FFmpeg archive.
 * @throws {Error} - Throws an error if an unsupported platform or architecture is detected.
 */
function getFfmpegUrl() {
  const platform = os.platform();
  const arch = os.arch(); // 'x64', 'arm64', etc.

  if (platform === 'win32') {
    return 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-git-full.7z';
  }

  if (platform === 'linux') {
    if (arch === 'arm64') {
      return 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz';
    }

    // Detect ARM architecture and decide between armhf and armel
    if (arch === 'arm' || arch === 'armv7l') {
      // Check for ARM hard-float (armhf) or soft-float (armel)
      const armVersion = os.arch(); // This gives 'arm', 'armv7l', etc.

      if (armVersion.includes('v7')) {
        return 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-armhf-static.tar.xz'; // armhf
      } else {
        return 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-armel-static.tar.xz'; // armel
      }
    }

    switch (arch) {
      case 'x64':
        return 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz';
      case 'ia32':
        return 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-i686-static.tar.xz';
      default:
        throw new Error(`Unsupported Linux architecture: ${arch}`);
    }
  }

  if (platform === 'darwin') {
    throw new Error('macOS: Please install FFmpeg using Homebrew or download a universal binary.');
  }

  throw new Error(`Unsupported platform or architecture: ${platform} ${arch}`);
}

/**
 * Download a file from a given URL and save it to a specified output path.
 *
 * @param {string} url - The URL to download the file from.
 * @param {string} outputPath - The file path where the downloaded file will be saved.
 * @returns {Promise<void>} - A promise that resolves when the download is complete.
 */
async function downloadFile(url, outputPath) {
  const res = await axios({ url, method: 'GET', responseType: 'stream' });
  await pipeline(res.data, createWriteStream(outputPath));
}

/**
 * Extract a downloaded archive to a specified directory.
 *
 * @param {string} archive - The path to the archive file (e.g., .tar.xz or .7z).
 * @param {string} destination - The path where the extracted files will be stored.
 * @returns {Promise<void>} - A promise that resolves when the extraction is complete.
 */
async function extractArchive(archive, destination) {
  if (isWindows) {
    return new Promise((resolve, reject) => {
      // Ensure you are importing 'node-7z' and '7zip-bin' correctly
      const stream = node7z.extractFull(archive, destination, { $bin: path7za });
      stream.on('end', resolve);
      stream.on('error', reject);
    });
  } else {
    mkdirSync(destination, { recursive: true });
    await execAsync(`tar -xf "${archive}" -C "${destination}"`);
  }
}

/**
 * Find the path to the `ffplay` binary within the extracted directory using glob.
 *
 * @param {string} root - The root directory where FFmpeg has been extracted.
 * @returns {string} - The path to the `ffplay` binary directory.
 * @throws {Error} - Throws an error if `ffplay` is not found in the directory.
 */
function findFfplayPath(root) {
  const binName = isWindows ? 'ffplay.exe' : 'ffplay';

  // Use glob to search for the ffplay binary in subdirectories (with 'bin' as part of the path)
  const matches = glob.sync(`**/bin/${binName}`, { cwd: root, absolute: true });

  if (matches.length > 0) {
    return path.dirname(matches[0]); // Return the directory containing the ffplay binary
  }

  // Legacy method
  const subdirs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  for (const dir of subdirs) {
    const binPath = path.join(root, dir, 'bin');
    const ffplay = path.join(binPath, binName);
    if (fs.existsSync(ffplay)) {
      return binPath;
    }
  }

  // Some builds extract directly without subfolders
  const flatPath = path.join(root, binName);
  if (fs.existsSync(flatPath)) {
    return root;
  }

  throw new Error(`${binName} not found in extracted FFmpeg folder`);
}

/**
 * Prepare the FFmpeg binaries by downloading, extracting, and setting the PATH for `ffplay`.
 *
 * @returns {Promise<string>} - A promise that resolves to the directory where `ffplay` is located.
 */
async function prepareFfplay() {
  const ffmpegUrl = getFfmpegUrl();

  if (!fs.existsSync(archivePath)) {
    console.log('Downloading FFmpeg...');
    await downloadFile(ffmpegUrl, archivePath);
  }

  if (!fs.existsSync(extractDir)) {
    console.log('Extracting FFmpeg...');
    await extractArchive(archivePath, extractDir);
  }

  const ffplayDir = findFfplayPath(extractDir);
  process.env.PATH = `${ffplayDir}${path.delimiter}${process.env.PATH}`;
  return ffplayDir;
}

/**
 * Play an MP3 file from a URL using `ffplay`.
 *
 * @param {string} mp3Url - The URL of the MP3 file to play.
 * @returns {Promise<void>} - A promise that resolves when the file is playing.
 */
export async function playMp3FromUrl(mp3Url) {
  const filename = path.basename(mp3Url.split('?')[0]);
  const filePath = path.join(cacheDir, 'audio', filename);

  if (!fs.existsSync(filePath)) {
    console.log(`Downloading ${filename}...`);
    await downloadFile(mp3Url, filePath);
  }

  const ffplayDir = await prepareFfplay();
  const ffplayBin = isWindows ? 'ffplay.exe' : 'ffplay';

  const ffplayProcess = spawn(`${ffplayDir}/${ffplayBin}`, [filePath, '-nodisp', '-autoexit'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });

  ffplayProcess.unref();

  setTimeout(() => {
    try {
      ffplayProcess.kill();
    } catch (err) {
      console.error('Error killing ffplay process:', err);
    }
  }, 5000);
}
