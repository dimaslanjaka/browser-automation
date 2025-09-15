import './chunk-BUSYA2B4.js';
import axios from 'axios';
import fs, { mkdirSync, createWriteStream } from 'fs';
import path from 'path';
import os from 'os';
import { exec, spawn } from 'child_process';
import { pipeline } from 'stream/promises';
import { promisify } from 'util';
import node7z from 'node-7z';
import * as glob from 'glob';
import { path7za } from '7zip-bin';

const execAsync = promisify(exec);
const isWindows = os.platform() === "win32";
const cacheDir = path.join(process.cwd(), ".cache");
mkdirSync(cacheDir, { recursive: true });
const extractDir = path.join(cacheDir, "ffmpeg");
const archivePath = path.join(cacheDir, isWindows ? "ffmpeg.7z" : "ffmpeg.tar.xz");
function getFfmpegUrl() {
  const platform = os.platform();
  const arch = os.arch();
  if (platform === "win32") {
    return "https://www.gyan.dev/ffmpeg/builds/ffmpeg-git-full.7z";
  }
  if (platform === "linux") {
    if (arch === "arm64") {
      return "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz";
    }
    if (arch === "arm" || arch === "armv7l") {
      const armVersion = os.arch();
      if (armVersion.includes("v7")) {
        return "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-armhf-static.tar.xz";
      } else {
        return "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-armel-static.tar.xz";
      }
    }
    switch (arch) {
      case "x64":
        return "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz";
      case "ia32":
        return "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-i686-static.tar.xz";
      default:
        throw new Error(`Unsupported Linux architecture: ${arch}`);
    }
  }
  if (platform === "darwin") {
    throw new Error("macOS: Please install FFmpeg using Homebrew or download a universal binary.");
  }
  throw new Error(`Unsupported platform or architecture: ${platform} ${arch}`);
}
async function downloadFile(url, outputPath) {
  const res = await axios({ url, method: "GET", responseType: "stream" });
  await pipeline(res.data, createWriteStream(outputPath));
}
async function extractArchive(archive, destination) {
  if (isWindows) {
    return new Promise((resolve, reject) => {
      const stream = node7z.extractFull(archive, destination, { $bin: path7za });
      stream.on("end", resolve);
      stream.on("error", reject);
    });
  } else {
    mkdirSync(destination, { recursive: true });
    await execAsync(`tar -xf "${archive}" -C "${destination}"`);
  }
}
function findFfplayPath(root) {
  const binName = isWindows ? "ffplay.exe" : "ffplay";
  const matches = glob.sync(`**/bin/${binName}`, { cwd: root, absolute: true });
  if (matches.length > 0) {
    return path.dirname(matches[0]);
  }
  const subdirs = fs.readdirSync(root, { withFileTypes: true }).filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);
  for (const dir of subdirs) {
    const binPath = path.join(root, dir, "bin");
    const ffplay = path.join(binPath, binName);
    if (fs.existsSync(ffplay)) {
      return binPath;
    }
  }
  const flatPath = path.join(root, binName);
  if (fs.existsSync(flatPath)) {
    return root;
  }
  throw new Error(`${binName} not found in extracted FFmpeg folder`);
}
async function prepareFfplay() {
  const ffmpegUrl = getFfmpegUrl();
  if (!fs.existsSync(archivePath)) {
    console.log("Downloading FFmpeg...");
    await downloadFile(ffmpegUrl, archivePath);
  }
  if (!fs.existsSync(extractDir)) {
    console.log("Extracting FFmpeg...");
    await extractArchive(archivePath, extractDir);
  }
  const ffplayDir = findFfplayPath(extractDir);
  process.env.PATH = `${ffplayDir}${path.delimiter}${process.env.PATH}`;
  return ffplayDir;
}
async function playMp3FromUrl(mp3Url) {
  const filename = path.basename(mp3Url.split("?")[0]);
  const filePath = path.join(cacheDir, "audio", filename);
  if (!fs.existsSync(filePath)) {
    console.log(`Downloading ${filename}...`);
    await downloadFile(mp3Url, filePath);
  }
  const ffplayDir = await prepareFfplay();
  const ffplayBin = isWindows ? "ffplay.exe" : "ffplay";
  const ffplayProcess = spawn(`${ffplayDir}/${ffplayBin}`, [filePath, "-nodisp", "-autoexit"], {
    detached: true,
    stdio: "ignore",
    windowsHide: true
  });
  ffplayProcess.unref();
  setTimeout(() => {
    try {
      ffplayProcess.kill();
    } catch (err) {
      console.error("Error killing ffplay process:", err);
    }
  }, 5e3);
}

export { playMp3FromUrl };
//# sourceMappingURL=beep.js.map
//# sourceMappingURL=beep.js.map