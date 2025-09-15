'use strict';

require('./chunk-4IBVXDKH.cjs');
var ansiColors = require('ansi-colors');
var glob = require('glob');
var moment = require('moment');
var nikParserJurusid = require('nik-parser-jurusid');
var crypto = require('node:crypto');
var fs = require('node:fs');
var path = require('node:path');
var sbgUtility = require('sbg-utility');
var date_js$1 = require('../src/date.js');
var nominatim_js = require('./address/nominatim.js');
var date_js = require('./date.js');
var utils_js = require('./utils.js');
var utilsBrowser_js = require('./utils-browser.js');
var skrin_utils_js = require('./skrin_utils.js');

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

var ansiColors__default = /*#__PURE__*/_interopDefault(ansiColors);
var glob__namespace = /*#__PURE__*/_interopNamespace(glob);
var moment__default = /*#__PURE__*/_interopDefault(moment);
var crypto__default = /*#__PURE__*/_interopDefault(crypto);
var fs__default = /*#__PURE__*/_interopDefault(fs);
var path__default = /*#__PURE__*/_interopDefault(path);

function getFileHash(filePath) {
  const fileBuffer = fs__default.default.readFileSync(filePath);
  return crypto__default.default.createHash("sha256").update(fileBuffer).digest("hex");
}
function getCacheKey(prefix, fileHash, ...params) {
  const shortHash = fileHash.substring(0, 7);
  const paramString = params.length > 0 ? `_${params.join("_")}` : "";
  return `${prefix}_${shortHash}${paramString}`;
}
function getCachedData(cacheKey, cacheDir = ".cache/temp") {
  try {
    const cacheFile = path__default.default.join(process.cwd(), cacheDir, `${cacheKey}.json`);
    if (fs__default.default.existsSync(cacheFile)) {
      const cachedData = JSON.parse(fs__default.default.readFileSync(cacheFile, "utf-8"));
      console.log(`Cache hit: ${cacheKey}`);
      return cachedData;
    }
  } catch (error) {
    console.warn(`Cache read error for ${cacheKey}:`, error.message);
  }
  return null;
}
function saveCachedData(cacheKey, data, cacheDir = ".cache/temp") {
  try {
    const fullCacheDir = path__default.default.join(process.cwd(), cacheDir);
    if (!fs__default.default.existsSync(fullCacheDir)) {
      fs__default.default.mkdirSync(fullCacheDir, { recursive: true });
    }
    const cacheFile = path__default.default.join(fullCacheDir, `${cacheKey}.json`);
    fs__default.default.writeFileSync(cacheFile, JSON.stringify(data, null, 2), "utf-8");
    console.log(`Cache saved: ${cacheKey}`);
  } catch (error) {
    console.warn(`Cache save error for ${cacheKey}:`, error.message);
  }
}
function clearCache(pattern, cacheDir = ".cache/temp") {
  try {
    const fullCacheDir = path__default.default.join(process.cwd(), cacheDir);
    if (!fs__default.default.existsSync(fullCacheDir)) {
      console.log("Cache directory does not exist");
      return;
    }
    const cacheFiles = glob__namespace.globSync(pattern, { cwd: fullCacheDir, absolute: true });
    let deletedCount = 0;
    cacheFiles.forEach((file) => {
      try {
        fs__default.default.unlinkSync(file);
        deletedCount++;
        console.log(`Deleted cache file: ${path__default.default.basename(file)}`);
      } catch (error) {
        console.warn(`Failed to delete ${file}:`, error.message);
      }
    });
    console.log(`Cleared ${deletedCount} cache file(s)`);
  } catch (error) {
    console.warn("Cache clear error:", error.message);
  }
}
function findByNik(datas, targetNik) {
  return datas.find((item) => item.nik === targetNik || `${item.nik}`.trim().includes(targetNik)) || null;
}
function matchFirstAndLastData(datas, matchData) {
  const firstItem = datas.at(0);
  const lastItem = datas.at(-1);
  const firstMatch = {
    nikMatch: (firstItem == null ? void 0 : firstItem.nik) === matchData.first.nik,
    namaMatch: (firstItem == null ? void 0 : firstItem.nama) === matchData.first.nama,
    actualNik: firstItem == null ? void 0 : firstItem.nik,
    actualNama: firstItem == null ? void 0 : firstItem.nama,
    expectedNik: matchData.first.nik,
    expectedNama: matchData.first.nama
  };
  const lastMatch = {
    nikMatch: (lastItem == null ? void 0 : lastItem.nik) === matchData.last.nik,
    namaMatch: (lastItem == null ? void 0 : lastItem.nama) === matchData.last.nama,
    actualNik: lastItem == null ? void 0 : lastItem.nik,
    actualNama: lastItem == null ? void 0 : lastItem.nama,
    expectedNik: matchData.last.nik,
    expectedNama: matchData.last.nama
  };
  return {
    first: firstMatch,
    last: lastMatch,
    overallMatch: firstMatch.nikMatch && firstMatch.namaMatch && lastMatch.nikMatch && lastMatch.namaMatch
  };
}
async function getDataRange(data, { fromNik, fromNama, toNik, toNama, outputFile = null }) {
  var _a, _b;
  const fromRow = data.find(
    (row) => (row.NIK === fromNik || row.nik === fromNik) && (row.NAMA === fromNama || row.nama === fromNama)
  );
  const toRow = data.find(
    (row) => (row.NIK === toNik || row.nik === toNik) && (row.NAMA === toNama || row.nama === toNama)
  );
  if (!fromRow) {
    throw new Error(`FromRow not found: NIK=${fromNik}, NAMA=${fromNama}`);
  }
  if (!toRow) {
    throw new Error(`ToRow not found: NIK=${toNik}, NAMA=${toNama}`);
  }
  const fromIndex = data.indexOf(fromRow);
  const toIndex = data.indexOf(toRow);
  const rangeData = data.slice(fromIndex, toIndex + 1);
  if (outputFile) {
    sbgUtility.writefile(outputFile, JSON.stringify(rangeData, null, 2), "utf8");
    utils_js.logLine(`
Range data written to: ${outputFile}`);
    utils_js.logLine(
      `File contains ${rangeData.length} rows from originalRowNumber ${(_a = rangeData[0]) == null ? void 0 : _a.originalRowNumber} to ${(_b = rangeData[rangeData.length - 1]) == null ? void 0 : _b.originalRowNumber}`
    );
  }
  if (rangeData[0] !== fromRow) {
    throw new Error("First row in rangeData is not fromRow");
  }
  if (rangeData[rangeData.length - 1] !== toRow) {
    throw new Error("Last row in rangeData is not toRow");
  }
  return rangeData;
}
async function fixData(data) {
  var _a, _b;
  const initialData = data || null;
  if (!initialData) throw new Error("Invalid data format: data is required");
  let nik = initialData.NIK || initialData.nik || null;
  const nama = initialData.NAMA || initialData.nama || null;
  if (!nik || !nama) throw new Error("Invalid data format: NIK and NAMA are required");
  nik = utilsBrowser_js.getNumbersOnly(nik);
  if (nik.length !== 16) throw new Error(`Invalid NIK length: ${nik} (expected 16 characters)`);
  if (nama.length < 3) throw new Error(`Invalid NAMA length: ${nama} (expected at least 3 characters)`);
  initialData.nik = nik;
  initialData.NIK = nik;
  initialData.nama = nama;
  initialData.NAMA = nama;
  const parsed_nik = nikParserJurusid.nikParserStrictSync(nik);
  if (parsed_nik.status == "success" && parsed_nik.data.lahir) {
    parsed_nik.data.originalLahir = parsed_nik.data.lahir;
    const momentParseNik = moment__default.default(parsed_nik.data.lahir, "YYYY-MM-DD", true);
    if (momentParseNik.isValid()) {
      parsed_nik.data.lahir = momentParseNik.format("DD/MM/YYYY");
    }
  }
  initialData.parsed_nik = parsed_nik.status === "success" ? parsed_nik : null;
  let tanggalEntry = initialData["TANGGAL ENTRY"] || initialData.tanggal;
  if (!tanggalEntry) {
    console.log("\nTanggal entry is required", initialData, "\n");
    process.exit(1);
  }
  if (!moment__default.default(tanggalEntry, "DD/MM/YYYY", true).isValid()) {
    if (typeof tanggalEntry === "string" && /\b(jan(uari)?|feb(ruari)?|mar(et)?|apr(il)?|mei|jun(i|e)?|jul(i|y)?|agu(stus)?|aug(ust)?|sep(tember)?|okt(ober)?|oct(ober)?|nov(ember)?|des(ember)?|dec(ember)?|bln\s+\w+|bulan\s+\w+)\b/i.test(
      tanggalEntry
    )) {
      const monthName = date_js.extractMonthName(tanggalEntry);
      if (!monthName) throw new Error(`Month name not found in tanggalEntry: ${tanggalEntry}`);
      tanggalEntry = sbgUtility.array_random(date_js.getDatesWithoutSundays(monthName, 2025, "DD/MM/YYYY", true));
      utils_js.logLine(
        `${ansiColors__default.default.cyan("[fixData]")} Generated new date for "${tanggalEntry}" from month name in entry: ${tanggalEntry}`
      );
    }
    const reparseTglLahir = moment__default.default(tanggalEntry, "DD/MM/YYYY", true);
    if (reparseTglLahir.day() === 0) throw new Error(`Tanggal entry cannot be a Sunday: ${tanggalEntry}`);
    if (!reparseTglLahir.isValid())
      throw new Error(`Invalid tanggalEntry format: ${tanggalEntry} (expected DD/MM/YYYY)`);
    initialData.tanggal = tanggalEntry;
    initialData["TANGGAL ENTRY"] = tanggalEntry;
  } else {
    const parsedDate = moment__default.default(tanggalEntry, "DD/MM/YYYY", true);
    if (parsedDate.day() === 0) {
      throw new Error(`Tanggal entry ${nik} cannot be a Sunday: ${tanggalEntry}`);
    }
    if (parsedDate.isAfter(moment__default.default())) {
      throw new Error(`Tanggal entry ${nik} cannot be in the future: ${tanggalEntry}`);
    }
  }
  let tglLahir = initialData["TGL LAHIR"] || null;
  if (tglLahir) {
    if (typeof tglLahir === "number") {
      const baseDate = moment__default.default("1900-01-01");
      let days = tglLahir - 1;
      if (days > 59) days--;
      tglLahir = baseDate.add(days, "days").format("DD/MM/YYYY");
      utils_js.logLine(`${ansiColors__default.default.cyan("[fixData]")} Converted Excel serial date to: ${tglLahir}`);
    } else if (typeof tglLahir === "string" && !moment__default.default(tglLahir, "DD/MM/YYYY", true).isValid()) {
      throw new Error(`Invalid TGL LAHIR format: ${tglLahir} (expected DD/MM/YYYY)`);
    }
    if (!moment__default.default(tglLahir, "DD/MM/YYYY", true).isValid())
      throw new Error(`Invalid TGL LAHIR date: ${tglLahir} (expected DD/MM/YYYY)`);
    initialData["TGL LAHIR"] = tglLahir;
  }
  let gender = parsed_nik.status === "success" ? parsed_nik == null ? void 0 : parsed_nik.data.kelamin : "Tidak Diketahui";
  if (gender.toLowerCase() === "l" || gender.toLowerCase() === "laki-laki") {
    gender = "Laki-laki";
  } else if (gender.toLowerCase() === "p" || gender.toLowerCase() === "perempuan") {
    gender = "Perempuan";
  }
  initialData.gender = gender;
  let age = 0;
  let birthDate = initialData.tgl_lahir || initialData["TGL LAHIR"] || null;
  if (birthDate) {
    age = date_js$1.getAge(birthDate, "DD/MM/YYYY");
    utils_js.logLine(`${ansiColors__default.default.cyan("[fixData]")} Age from TGL LAHIR: ${age} years`);
  } else if (parsed_nik.status === "success" && parsed_nik.data.lahir) {
    age = date_js$1.getAge(parsed_nik.data.lahir);
    utils_js.logLine(`${ansiColors__default.default.cyan("[fixData]")} Age from NIK: ${age} years`);
  }
  data.age = age;
  let pekerjaan = initialData.pekerjaan || initialData.PEKERJAAN || null;
  if (!pekerjaan) {
    if (!pekerjaan) {
      if (age > 55 || age <= 20) {
        pekerjaan = "Tidak Bekerja";
      } else {
        pekerjaan = gender && gender.toLowerCase() === "perempuan" ? "IRT" : "Wiraswasta";
      }
    }
  } else {
    utils_js.logLine(`${ansiColors__default.default.cyan("[fixData]")} Pekerjaan: ${pekerjaan}`);
  }
  const jobMappings = [
    { pattern: /rumah\s*tangga|irt/i, value: "IRT" },
    { pattern: /swasta|pedagang/i, value: "Wiraswasta" },
    { pattern: /tukang|buruh/i, value: "Buruh " },
    { pattern: /tidak\s*bekerja|belum\s*bekerja|pensiun|belum\/tidak\s*bekerja/i, value: "Tidak Bekerja" },
    { pattern: /pegawai\s*negeri(\s*sipil)?|pegawai\s*negri/i, value: "PNS " },
    { pattern: /guru|dosen/i, value: "Guru/ Dosen" },
    { pattern: /perawat|dokter/i, value: "Tenaga Profesional Medis " },
    { pattern: /pengacara|wartawan/i, value: "Tenaga Profesional Non Medis " },
    { pattern: /pelajar|siswa|siswi|sekolah/i, value: "Pelajar/ Mahasiswa" },
    { pattern: /s[o,u]pir/i, value: "Sopir " }
  ];
  for (const { pattern, value } of jobMappings) {
    if (pattern.test(pekerjaan.toLowerCase())) {
      pekerjaan = value;
      utils_js.logLine(`${ansiColors__default.default.cyan("[fixData]")} Pekerjaan mapped: ${pekerjaan}`);
      break;
    }
  }
  if (pekerjaan) {
    initialData.pekerjaan = pekerjaan;
    initialData.PEKERJAAN = pekerjaan;
    utils_js.logLine(`${ansiColors__default.default.cyan("[fixData]")} Pekerjaan fixed: ${pekerjaan}`);
  } else {
    throw new Error(`Pekerjaan could not be determined for NIK: ${nik}`);
  }
  let alamat = initialData.alamat || initialData.ALAMAT || null;
  if (!alamat) {
    if (initialData.parsed_nik && initialData.parsed_nik.status === "success") {
      const parsed_data = initialData.parsed_nik.data;
      alamat = [(_b = (_a = parsed_data.kelurahan) == null ? void 0 : _a[0]) == null ? void 0 : _b.name, parsed_data.namaKec, parsed_data.kotakab, parsed_data.provinsi].filter((part) => part !== void 0 && part !== null && part !== "").join(", ");
      utils_js.logLine(`${ansiColors__default.default.cyan("[fixData]")} Alamat from parsed NIK: ${alamat}`);
      const keywordAddr = `${parsed_data.kelurahan}, ${parsed_data.namaKec}, Surabaya, Jawa Timur`.trim();
      const address = await nominatim_js.geocodeWithNominatim(keywordAddr);
      data._address = address;
      let { kotakab = "", namaKec = "", provinsi = "", kelurahan = [] } = parsed_data;
      if (kotakab.length === 0 || namaKec.length === 0 || provinsi.length === 0) {
        utils_js.logLine(`Fetching address from Nominatim for: ${keywordAddr}`);
        utils_js.logLine("Nominatim result:", address);
        const addr = address.address || {};
        if (kelurahan.length === 0) kelurahan = [addr.village || addr.hamlet || ""];
        if (namaKec.length === 0) namaKec = addr.suburb || addr.city_district || "";
        if (kotakab.length === 0) kotakab = addr.city || addr.town || addr.village || "Kota Surabaya";
        if (provinsi.length === 0) provinsi = addr.state || addr.province || "Jawa Timur";
        if (kotakab.toLowerCase().includes("surabaya")) {
          kotakab = "Kota Surabaya";
        }
        if (kotakab.length === 0 || namaKec.length === 0) {
          throw new Error("\u274C Failed to take the patient's city or town");
        }
        parsed_data.kelurahan = kelurahan;
        parsed_data.namaKec = namaKec;
        parsed_data.kotakab = kotakab;
        parsed_data.provinsi = provinsi;
        initialData.parsed_nik.data = parsed_data;
      }
    } else {
      throw new Error(`Alamat is required for NIK: ${nik}`);
    }
  }
  initialData.alamat = alamat;
  initialData.ALAMAT = alamat;
  let tinggi = initialData.TB || initialData.tb || null;
  let berat = initialData.bb || initialData.BB || null;
  if (!tinggi) {
    tinggi = skrin_utils_js.getTinggiBadan(age, gender);
  }
  if (!berat) {
    berat = skrin_utils_js.getBeratBadan(age, gender);
  }
  initialData.tb = tinggi;
  initialData.TB = tinggi;
  initialData.bb = berat;
  initialData.BB = berat;
  return initialData;
}

exports.clearCache = clearCache;
exports.findByNik = findByNik;
exports.fixData = fixData;
exports.getCacheKey = getCacheKey;
exports.getCachedData = getCachedData;
exports.getDataRange = getDataRange;
exports.getFileHash = getFileHash;
exports.matchFirstAndLastData = matchFirstAndLastData;
exports.saveCachedData = saveCachedData;
//# sourceMappingURL=xlsx-helper.cjs.map
//# sourceMappingURL=xlsx-helper.cjs.map