import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { mkdirSync } from 'fs';
import { spawn } from 'child_process';
import pkg from 'node-7z';
const { extractFull } = pkg;
import { path7za } from '7zip-bin';

const cacheDir = path.join(process.cwd(), '.cache');
const archivePath = path.join(cacheDir, 'ffmpeg.7z');
const extractDir = path.join(cacheDir, 'ffmpeg');
const ffmpegUrl = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-git-full.7z';

mkdirSync(cacheDir, { recursive: true });

/**
 * Downloads a file from a URL to the specified output path.
 * @param {string} url - The URL to download from.
 * @param {string} outputPath - The local path to save the file.
 * @returns {Promise<void>}
 */
async function downloadFile(url, outputPath) {
  const res = await axios({ url, method: 'GET', responseType: 'stream' });
  const writer = fs.createWriteStream(outputPath);
  res.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

/**
 * Extracts a 7z archive to a destination folder.
 * @param {string} archive - The path to the archive.
 * @param {string} destination - The extraction path.
 * @returns {Promise<void>}
 */
async function extract7z(archive, destination) {
  return new Promise((resolve, reject) => {
    const stream = extractFull(archive, destination, { $bin: path7za });
    stream.on('end', resolve);
    stream.on('error', reject);
  });
}

/**
 * Searches for ffplay.exe in the extracted FFmpeg folder.
 * @param {string} root - Root directory to search.
 * @returns {string} - Directory containing ffplay.exe.
 * @throws Will throw an error if ffplay.exe is not found.
 */
function findFfplayPath(root) {
  const subdirs = fs
    .readdirSync(root, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())
    .map((dirent) => dirent.name);

  for (const dir of subdirs) {
    const binPath = path.join(root, dir, 'bin');
    const ffplayExe = path.join(binPath, 'ffplay.exe');
    if (fs.existsSync(ffplayExe)) {
      return binPath;
    }
  }

  throw new Error('ffplay.exe not found in extracted FFmpeg folder');
}

/**
 * Prepares ffplay by downloading and extracting FFmpeg if needed.
 * @returns {Promise<string>} - Directory containing ffplay.exe.
 */
async function prepareFfplay() {
  if (!fs.existsSync(archivePath)) {
    console.log('Downloading FFmpeg...');
    await downloadFile(ffmpegUrl, archivePath);
  }

  if (!fs.existsSync(extractDir)) {
    console.log('Extracting FFmpeg...');
    await extract7z(archivePath, extractDir);
  }

  const ffplayDir = findFfplayPath(extractDir);
  process.env.PATH = `${ffplayDir};${process.env.PATH}`;
  return ffplayDir;
}

/**
 * Downloads an MP3 file from a given URL and plays it using ffplay.
 * @param {string} mp3Url - The URL of the MP3 file to play.
 * @returns {Promise<void>}
 */
export async function playMp3FromUrl(mp3Url) {
  const filename = path.basename(mp3Url.split('?')[0]);
  const filePath = path.join(cacheDir, filename);

  if (!fs.existsSync(filePath)) {
    console.log(`Downloading ${filename}...`);
    await downloadFile(mp3Url, filePath);
  }

  await prepareFfplay();

  const ffplayProcess = spawn('ffplay', [filePath, '-nodisp', '-autoexit'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });

  ffplayProcess.unref();

  // Optional cleanup timeout
  setTimeout(() => {
    try {
      ffplayProcess.kill();
    } catch (err) {
      console.error('Error killing ffplay process:', err);
    }
  }, 5000);
}

// https://assets.mixkit.co/active_storage/sfx/1084/1084.wav
