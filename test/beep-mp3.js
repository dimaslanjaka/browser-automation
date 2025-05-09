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
const filePath = path.join(cacheDir, 'beep.mp3');
const beepUrl = 'https://media.geeksforgeeks.org/wp-content/uploads/20190531135120/beep.mp3';
const ffmpegUrl = 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-git-full.7z';

mkdirSync(cacheDir, { recursive: true });

async function downloadFile(url, outputPath) {
  const res = await axios({ url, method: 'GET', responseType: 'stream' });
  const writer = fs.createWriteStream(outputPath);
  res.data.pipe(writer);
  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

async function extract7z(archive, destination) {
  return new Promise((resolve, reject) => {
    const stream = extractFull(archive, destination, { $bin: path7za });
    stream.on('end', resolve);
    stream.on('error', reject);
  });
}

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

async function downloadAndPlay() {
  if (!fs.existsSync(filePath)) {
    console.log('Downloading beep.mp3...');
    await downloadFile(beepUrl, filePath);
  }

  await prepareFfplay();

  // Use spawn to launch ffplay in detached mode
  const ffplayProcess = spawn('ffplay', [filePath, '-nodisp', '-autoexit'], {
    detached: true, // Detach from the parent process
    stdio: 'ignore', // Don't wait for the process to finish
    windowsHide: true // Hide window (on Windows)
  });

  // Unref the process to prevent blocking the terminal
  ffplayProcess.unref();

  // Optional: Add cleanup after a short delay
  setTimeout(() => {
    try {
      ffplayProcess.kill(); // Kill any lingering ffplay process
    } catch (err) {
      console.error('Error killing ffplay process:', err);
    }
  }, 5000);
}

downloadAndPlay().catch(console.error);
