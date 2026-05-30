import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { pipeline } from 'stream/promises';
import { promisify } from 'util';
import { exec } from 'child_process';
import node7z from 'node-7z';
import * as glob from 'glob';
import { path7za } from '7zip-bin';

const execAsync = promisify(exec);
const isWindows = os.platform() === 'win32';

const cacheDir = path.join(process.cwd(), '.cache');
fs.mkdirSync(cacheDir, { recursive: true });

const extractDir = path.join(cacheDir, 'ffmpeg');
let ffplayPreparationPromise;

/**
 * @typedef {object} FfmpegUrlOptions
 * @property {string} [customUrl] - Custom FFmpeg archive URL. When set, this is used directly.
 * @property {'legacy' | 'btbn'} [source] - URL source preset. Defaults to 'legacy'.
 * @property {'gpl' | 'lgpl'} [linuxLicense] - Linux build license variant for BtbN source. Defaults to 'gpl'.
 */

/**
 * Create an archive path based on URL extension.
 *
 * @param {string} url - FFmpeg archive URL.
 * @returns {string} - Local archive path in cache directory.
 */
function getArchivePathFromUrl(url) {
  const parsedUrl = new URL(url);
  const lowerPath = parsedUrl.pathname.toLowerCase();

  if (lowerPath.endsWith('.tar.xz')) {
    return path.join(cacheDir, 'ffmpeg.tar.xz');
  }

  if (lowerPath.endsWith('.zip')) {
    return path.join(cacheDir, 'ffmpeg.zip');
  }

  if (lowerPath.endsWith('.7z')) {
    return path.join(cacheDir, 'ffmpeg.7z');
  }

  const fallbackExt = isWindows ? '.7z' : '.tar.xz';
  return path.join(cacheDir, `ffmpeg${fallbackExt}`);
}

/**
 * Get the appropriate FFmpeg download URL based on the current platform and architecture.
 *
 * @param {FfmpegUrlOptions} [options] - FFmpeg URL selection options.
 * @returns {string} - The URL to download the FFmpeg archive.
 * @throws {Error} - Throws an error if an unsupported platform or architecture is detected.
 */
function getFfmpegUrl(options = {}) {
  if (options.customUrl) {
    return options.customUrl;
  }

  const source = options.source ?? 'btbn';
  const linuxLicense = options.linuxLicense ?? 'gpl';
  const platform = os.platform(); // 'win32', 'linux', 'darwin', etc.
  const arch = os.arch(); // 'x64', 'arm64', etc.

  if (source === 'btbn') {
    if (platform === 'win32') {
      return 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl-shared.zip';
    }

    if (platform === 'linux') {
      if (arch === 'arm64') {
        return linuxLicense === 'lgpl'
          ? 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linuxarm64-lgpl-shared.tar.xz'
          : 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linuxarm64-gpl-shared.tar.xz';
      }

      if (arch === 'x64') {
        return linuxLicense === 'lgpl'
          ? 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-lgpl-shared.tar.xz'
          : 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-linux64-gpl-shared.tar.xz';
      }

      throw new Error(`Unsupported Linux architecture for BtbN source: ${arch}`);
    }

    if (platform === 'darwin') {
      throw new Error('macOS: Please install FFmpeg using Homebrew or download a universal binary.');
    }

    throw new Error(`Unsupported platform or architecture: ${platform} ${arch}`);
  }

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
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  if (fs.existsSync(outputPath)) {
    try {
      const localStats = fs.statSync(outputPath);
      const headRes = await axios({
        url,
        method: 'HEAD',
        maxRedirects: 5,
        validateStatus: (status) => status >= 200 && status < 400
      });

      const contentLength = headRes.headers['content-length'];
      const remoteSize = Number.parseInt(contentLength, 10);
      const lastModifiedHeader = headRes.headers['last-modified'];
      const remoteModifiedAt = lastModifiedHeader ? new Date(lastModifiedHeader) : undefined;

      const hasValidRemoteSize = Number.isFinite(remoteSize);
      const isSizeEqual = hasValidRemoteSize ? remoteSize === localStats.size : true;
      const hasValidRemoteModifiedAt = remoteModifiedAt instanceof Date && !Number.isNaN(remoteModifiedAt.getTime());
      const isRemoteNotNewer = hasValidRemoteModifiedAt ? localStats.mtimeMs >= remoteModifiedAt.getTime() : true;

      if (isSizeEqual && isRemoteNotNewer) {
        return;
      }
    } catch {
      // Continue with download when metadata cannot be checked.
    }
  }

  const res = await axios({ url, method: 'GET', responseType: 'stream' });
  await pipeline(res.data, fs.createWriteStream(outputPath));

  const downloadedLastModifiedHeader = res.headers['last-modified'];
  if (downloadedLastModifiedHeader) {
    const downloadedLastModifiedAt = new Date(downloadedLastModifiedHeader);
    if (!Number.isNaN(downloadedLastModifiedAt.getTime())) {
      await fs.promises.utimes(outputPath, downloadedLastModifiedAt, downloadedLastModifiedAt).catch(() => undefined);
    }
  }
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
    fs.mkdirSync(destination, { recursive: true });
    return new Promise((resolve, reject) => {
      // Ensure you are importing 'node-7z' and '7zip-bin' correctly
      const stream = node7z.extractFull(archive, destination, { $bin: path7za });
      stream.on('end', resolve);
      stream.on('error', reject);
    });
  } else {
    fs.mkdirSync(destination, { recursive: true });
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
 * @param {FfmpegUrlOptions} [options] - FFmpeg URL selection options.
 * @returns {Promise<string>} - A promise that resolves to the directory where `ffplay` is located.
 */
async function prepareFfplay(options = {}) {
  if (ffplayPreparationPromise) {
    return ffplayPreparationPromise;
  }

  ffplayPreparationPromise = (async () => {
    const ffmpegUrl = getFfmpegUrl(options);
    const archivePath = getArchivePathFromUrl(ffmpegUrl);

    if (!fs.existsSync(archivePath)) {
      console.log('Downloading FFmpeg...');
      await downloadFile(ffmpegUrl, archivePath);
    }

    try {
      const ffplayDir = findFfplayPath(extractDir);
      process.env.PATH = `${ffplayDir}${path.delimiter}${process.env.PATH}`;
      return ffplayDir;
    } catch {
      // Continue to extraction when ffplay is not found in cache.
    }

    if (fs.existsSync(archivePath)) {
      console.log('Extracting FFmpeg...');
      try {
        await extractArchive(archivePath, extractDir);
      } catch (e) {
        console.log('Error extracting FFmpeg:', e);

        console.log('Re-downloading FFmpeg archive...');
        await downloadFile(ffmpegUrl, archivePath);

        console.log('Extracting FFmpeg...');
        await extractArchive(archivePath, extractDir);
      }
    }

    const ffplayDir = findFfplayPath(extractDir);
    process.env.PATH = `${ffplayDir}${path.delimiter}${process.env.PATH}`;
    return ffplayDir;
  })().catch((error) => {
    ffplayPreparationPromise = undefined;
    throw error;
  });

  return ffplayPreparationPromise;
}

/**
 * Play an MP3 file from a URL using `ffplay`.
 *
 * @param {string} mp3Url - The URL of the MP3 file to play.
 * @param {FfmpegUrlOptions} [ffmpegOptions] - FFmpeg URL selection options.
 * @returns {Promise<void>} - A promise that resolves when the file is playing.
 */
export async function playMp3FromUrl(mp3Url, ffmpegOptions) {
  const filename = path.basename(mp3Url.split('?')[0]);
  const filePath = path.join(cacheDir, 'audio', filename);

  if (!fs.existsSync(filePath)) {
    console.log(`Downloading ${filename}...`);
    await downloadFile(mp3Url, filePath);
  }

  const ffplayDir = await prepareFfplay(ffmpegOptions);
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
