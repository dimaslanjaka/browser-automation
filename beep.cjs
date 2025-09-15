'use strict';

require('./chunk-4IBVXDKH.cjs');
var axios = require('axios');
var fs = require('fs');
var path = require('path');
var os = require('os');
var child_process = require('child_process');
var promises = require('stream/promises');
var util = require('util');
var node7z = require('node-7z');
var glob = require('glob');
var _7zipBin = require('7zip-bin');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var axios__default = /*#__PURE__*/_interopDefault(axios);
var fs__default = /*#__PURE__*/_interopDefault(fs);
var path__default = /*#__PURE__*/_interopDefault(path);
var os__default = /*#__PURE__*/_interopDefault(os);
var node7z__default = /*#__PURE__*/_interopDefault(node7z);
var glob__namespace = /*#__PURE__*/_interopNamespace(glob);

const execAsync = util.promisify(child_process.exec);
const isWindows = os__default.default.platform() === "win32";
const cacheDir = path__default.default.join(process.cwd(), ".cache");
fs.mkdirSync(cacheDir, { recursive: true });
const extractDir = path__default.default.join(cacheDir, "ffmpeg");
const archivePath = path__default.default.join(cacheDir, isWindows ? "ffmpeg.7z" : "ffmpeg.tar.xz");
function getFfmpegUrl() {
  const platform = os__default.default.platform();
  const arch = os__default.default.arch();
  if (platform === "win32") {
    return "https://www.gyan.dev/ffmpeg/builds/ffmpeg-git-full.7z";
  }
  if (platform === "linux") {
    if (arch === "arm64") {
      return "https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-arm64-static.tar.xz";
    }
    if (arch === "arm" || arch === "armv7l") {
      const armVersion = os__default.default.arch();
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
  const res = await axios__default.default({ url, method: "GET", responseType: "stream" });
  await promises.pipeline(res.data, fs.createWriteStream(outputPath));
}
async function extractArchive(archive, destination) {
  if (isWindows) {
    return new Promise((resolve, reject) => {
      const stream = node7z__default.default.extractFull(archive, destination, { $bin: _7zipBin.path7za });
      stream.on("end", resolve);
      stream.on("error", reject);
    });
  } else {
    fs.mkdirSync(destination, { recursive: true });
    await execAsync(`tar -xf "${archive}" -C "${destination}"`);
  }
}
function findFfplayPath(root) {
  const binName = isWindows ? "ffplay.exe" : "ffplay";
  const matches = glob__namespace.sync(`**/bin/${binName}`, { cwd: root, absolute: true });
  if (matches.length > 0) {
    return path__default.default.dirname(matches[0]);
  }
  const subdirs = fs__default.default.readdirSync(root, { withFileTypes: true }).filter((dirent) => dirent.isDirectory()).map((dirent) => dirent.name);
  for (const dir of subdirs) {
    const binPath = path__default.default.join(root, dir, "bin");
    const ffplay = path__default.default.join(binPath, binName);
    if (fs__default.default.existsSync(ffplay)) {
      return binPath;
    }
  }
  const flatPath = path__default.default.join(root, binName);
  if (fs__default.default.existsSync(flatPath)) {
    return root;
  }
  throw new Error(`${binName} not found in extracted FFmpeg folder`);
}
async function prepareFfplay() {
  const ffmpegUrl = getFfmpegUrl();
  if (!fs__default.default.existsSync(archivePath)) {
    console.log("Downloading FFmpeg...");
    await downloadFile(ffmpegUrl, archivePath);
  }
  if (!fs__default.default.existsSync(extractDir)) {
    console.log("Extracting FFmpeg...");
    await extractArchive(archivePath, extractDir);
  }
  const ffplayDir = findFfplayPath(extractDir);
  process.env.PATH = `${ffplayDir}${path__default.default.delimiter}${process.env.PATH}`;
  return ffplayDir;
}
async function playMp3FromUrl(mp3Url) {
  const filename = path__default.default.basename(mp3Url.split("?")[0]);
  const filePath = path__default.default.join(cacheDir, "audio", filename);
  if (!fs__default.default.existsSync(filePath)) {
    console.log(`Downloading ${filename}...`);
    await downloadFile(mp3Url, filePath);
  }
  const ffplayDir = await prepareFfplay();
  const ffplayBin = isWindows ? "ffplay.exe" : "ffplay";
  const ffplayProcess = child_process.spawn(`${ffplayDir}/${ffplayBin}`, [filePath, "-nodisp", "-autoexit"], {
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

exports.playMp3FromUrl = playMp3FromUrl;
//# sourceMappingURL=beep.cjs.map
//# sourceMappingURL=beep.cjs.map