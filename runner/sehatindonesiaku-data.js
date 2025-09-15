import '../chunk-BUSYA2B4.js';
import 'dotenv/config.js';
import fs from 'fs-extra';
import minimist from 'minimist';
import moment from 'moment';
import { normalizePathUnix } from 'sbg-utility';
import SharedPreferences from 'sbg-utility/dist/utils/SharedPreferences';
import path from 'upath';
import xlsx from 'xlsx';
import { LogDatabase } from '../database/LogDatabase.js';
import { downloadSheets } from '../utils/googleSheet.js';

const { MYSQL_HOST, MYSQL_USER, MYSQL_PASS, MYSQL_PORT } = process.env;
let sehatindonesiakuDb = new LogDatabase("sehatindonesiaku-kemkes", {
  connectTimeout: 6e4,
  connectionLimit: 10,
  host: MYSQL_HOST || "localhost",
  user: MYSQL_USER || "root",
  password: MYSQL_PASS || "",
  port: Number(MYSQL_PORT) || 3306,
  type: MYSQL_HOST ? "mysql" : "sqlite"
});
async function getSehatIndonesiaKuDb() {
  if (!sehatindonesiakuDb) {
    console.log("[DB] Creating sehatindonesiaku-kemkes pool");
    sehatindonesiakuDb = new LogDatabase("sehatindonesiaku-kemkes", {
      connectTimeout: 6e4,
      connectionLimit: 10,
      host: MYSQL_HOST || "localhost",
      user: MYSQL_USER || "root",
      password: MYSQL_PASS || "",
      port: Number(MYSQL_PORT) || 3306,
      type: MYSQL_HOST ? "mysql" : "sqlite"
    });
  }
  await sehatindonesiakuDb.waitReady();
  return sehatindonesiakuDb;
}
function restartSehatIndonesiaKuDb() {
  if (sehatindonesiakuDb) {
    sehatindonesiakuDb.close().then(() => {
      console.log("[DB] Closed sehatindonesiaku-kemkes pool");
    }).catch(() => {
    });
  }
  console.log("[DB] Restarting sehatindonesiaku-kemkes pool");
  sehatindonesiakuDb = new LogDatabase("sehatindonesiaku-kemkes", {
    connectTimeout: 6e4,
    connectionLimit: 10
  });
  return sehatindonesiakuDb;
}
async function closeSehatIndonesiaKuDb() {
  if (sehatindonesiakuDb) {
    await sehatindonesiakuDb.close();
    sehatindonesiakuDb = void 0;
    console.log("[DB] Closed sehatindonesiaku-kemkes pool");
  }
}
const sehatindonesiakuPref = new SharedPreferences({ namespace: "sehatindonesiaku-kemkes" });
const xlsxFile = path.join(process.cwd(), ".cache/sheets/sehatindonesiaku.xlsx");
const tanggal_pemeriksaan = sehatindonesiakuPref.getString("tanggal_pemeriksaan", "24/08/2025");
process.on("SIGINT", async () => {
  await closeSehatIndonesiaKuDb();
  console.log("[DB] Closed sehatindonesiaku-kemkes pool (SIGINT)");
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await closeSehatIndonesiaKuDb();
  console.log("[DB] Closed sehatindonesiaku-kemkes pool (SIGTERM)");
  process.exit(0);
});
process.on("exit", () => {
  closeSehatIndonesiaKuDb();
  console.log("[DB] Closed sehatindonesiaku-kemkes pool (exit)");
});
async function parseXlsxFile(filePath = xlsxFile, rangeIndex = 6, rangeEndIndex = Number.MAX_SAFE_INTEGER) {
  const workbook = xlsx.readFile(filePath);
  const sheetName = "Format Full";
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Sheet '${sheetName}' not found in file: ${filePath}`);
  }
  let sheetToJsonRange = rangeIndex;
  const ref = sheet["!ref"];
  let maxRow = Number.MAX_SAFE_INTEGER;
  if (ref) {
    const [, endCell] = ref.split(":");
    maxRow = xlsx.utils.decode_cell(endCell).r;
  }
  const effectiveEndIndex = Math.min(rangeEndIndex, maxRow);
  if (typeof rangeEndIndex === "number" && effectiveEndIndex >= rangeIndex) {
    if (ref) {
      const [, endCell] = ref.split(":");
      const startCell = xlsx.utils.encode_cell({ c: 0, r: rangeIndex });
      const endCol = xlsx.utils.decode_cell(endCell).c;
      const endCellStr = xlsx.utils.encode_cell({ c: endCol, r: effectiveEndIndex });
      sheetToJsonRange = `${startCell}:${endCellStr}`;
    }
  }
  const data = xlsx.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    range: sheetToJsonRange
  });
  const result = [];
  for (const row of data) {
    const obj = {
      tanggal_pemeriksaan,
      nik: null,
      nama: null,
      nomor_wa: null,
      tanggal_lahir: null,
      jenis_kelamin: null,
      pekerjaan: null,
      provinsi: null,
      alamat: null
    };
    if (!row || row.length === 0) {
      continue;
    }
    for (let index = 0; index < row.length; index++) {
      if (index === 0) {
        obj["nik"] = row[index];
        continue;
      } else if (index === 1) {
        obj["nama"] = row[index];
        continue;
      } else if (index === 2) {
        let tgl_lahir = row[index];
        if (typeof tgl_lahir === "number") {
          const jsDate = new Date(Math.round((tgl_lahir - 25569) * 86400 * 1e3));
          tgl_lahir = jsDate.toLocaleDateString("en-GB");
        }
        obj["tanggal_lahir"] = tgl_lahir;
        continue;
      } else if (index === 3) {
        obj["jenis_kelamin"] = row[index];
        continue;
      } else if (index === 4) {
        let tglPemeriksaan = row[index];
        if (typeof tglPemeriksaan === "number") {
          const jsDate = new Date(Math.round((tglPemeriksaan - 25569) * 86400 * 1e3));
          tglPemeriksaan = jsDate.toLocaleDateString("en-GB");
        }
        obj["tanggal_pemeriksaan"] = tglPemeriksaan;
        continue;
      } else if (index === 5) {
        if (row[index] && String(row[index]).startsWith("+62")) {
          obj["nomor_wa"] = String(row[index]);
        } else if (row[index] && String(row[index]).startsWith("0")) {
          obj["nomor_wa"] = "+62" + String(row[index]).substring(1);
        } else if (row[index] && String(row[index]).toString().trim() !== "") {
          obj["nomor_wa"] = "+62" + String(row[index]);
        }
        continue;
      } else if (index === 6) {
        obj["pekerjaan"] = row[index];
        continue;
      } else if (index === 7) {
        obj["provinsi"] = row[index];
        continue;
      } else if (index === 8) {
        obj["alamat"] = row[index];
        continue;
      } else if (index === 44) {
        obj["tinggi_badan"] = row[index];
        continue;
      } else if (index === 45) {
        obj["berat_badan"] = row[index];
        continue;
      } else if (index === 46) {
        obj["lingkar_perut"] = row[index];
        continue;
      } else if (index === 47) {
        obj["sistolik"] = row[index];
        continue;
      } else if (index === 48) {
        obj["diastolik"] = row[index];
        continue;
      } else if (index === 49) {
        obj["gula_darah"] = row[index];
        continue;
      }
      obj[`Column ${index + 1}`] = row[index];
    }
    result.push(obj);
  }
  return result.map((item) => {
    const cleanedItem = {};
    for (const key in item) {
      if (item[key] !== null && item[key] !== void 0 && item[key] !== "+62null") {
        cleanedItem[key] = item[key];
      }
    }
    return cleanedItem;
  }).filter((item) => Object.keys(item).length > 0);
}
const outPath = path.join(process.cwd(), ".cache/sheets/sehatindonesiaku-data.json");
async function downloadAndProcessXlsx(options = {}) {
  const { rangeIndex = 6, rangeEndIndex = Number.MAX_SAFE_INTEGER, spreadsheetId, cache = true } = options;
  const resolvedSpreadsheetId = spreadsheetId || process.env.KEMKES_SPREADSHEET_ID;
  if (!resolvedSpreadsheetId) {
    throw new Error(
      "Spreadsheet ID is required but not provided. Pass it explicitly as an argument, or set the KEMKES_SPREADSHEET_ID environment variable."
    );
  }
  if (!cache) {
    console.log("Cache is disabled. Forcing download of the spreadsheet.");
  }
  const downloadResult = await downloadSheets(resolvedSpreadsheetId, !cache);
  const result = await parseXlsxFile(downloadResult.xlsxFilePath, rangeIndex, rangeEndIndex);
  fs.ensureDirSync(path.dirname(outPath));
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf-8");
  console.log(`Parsed XLSX data (Format Full) written to: ${outPath}`);
}
async function getExcelData() {
  const rawData = JSON.parse(fs.readFileSync(outPath, "utf-8"));
  return rawData;
}
async function getDbData() {
  const dbData = (await sehatindonesiakuDb.getLogs()).filter((item) => item && item.data);
  for (let i = dbData.length - 1; i >= 0; i--) {
    const item = dbData[i];
    const excelItem = (await getExcelData()).find((row) => row.nik === item.data.nik);
    if (excelItem) {
      console.log(`Updating data for NIK: ${item.data.nik}`);
      const newItem = { ...item, ...excelItem };
      dbData[i] = newItem;
      await sehatindonesiakuDb.addLog({
        id: item.data.nik,
        data: newItem,
        message: item.message
      });
    }
  }
  return dbData;
}
function fixKemkesDataItem(item) {
  if (!item.nomor_wa) {
    item.nomor_wa = "81316270797";
  }
  if (item.nomor_wa && String(item.nomor_wa).startsWith("0")) {
    item.nomor_wa = "+62" + String(item.nomor_wa).substring(1);
  } else if (item.nomor_wa && !String(item.nomor_wa).startsWith("+62")) {
    item.nomor_wa = "+62" + String(item.nomor_wa);
  }
  if (!item.tanggal_pemeriksaan) {
    item.tanggal_pemeriksaan = moment().format("DD/MM/YYYY");
  }
  return item;
}
function showHelp() {
  const [node, script] = process.argv;
  console.log(`Usage: ${normalizePathUnix(node)} ${normalizePathUnix(script)} [options]
`);
  console.log("Options:");
  console.log("  --start <row>    Start row index (default: 320)");
  console.log("  --end <row>      End row index (default: 500)");
  console.log("  --cache          Use cache (default: true). If set to false, always download the spreadsheet.");
  console.log("  --nc, --no-cache Alias for --cache false (no cache, always download)");
  console.log("  --help, -h       Show this help message");
}
if (process.argv.some((arg) => /sehatindonesiaku-data\.(ts|mjs|js|cjs)$/.test(arg))) {
  (async () => {
    const cliArgs = minimist(process.argv.slice(2), {
      alias: { h: "help", nc: "cache" },
      // `--nc` works as shorthand
      default: { cache: true }
      // cache enabled unless explicitly disabled
    });
    if (cliArgs.help) {
      showHelp();
      process.exit(0);
    }
    const start = cliArgs.start !== void 0 && !isNaN(parseInt(cliArgs.start)) ? parseInt(cliArgs.start) - 1 : 315;
    let end;
    if (typeof cliArgs.end === "string" && cliArgs.end.toLowerCase() === "max") {
      end = Number.MAX_SAFE_INTEGER;
    } else if (cliArgs.end !== void 0 && !isNaN(parseInt(cliArgs.end))) {
      end = parseInt(cliArgs.end) - 1;
    } else {
      end = 1e3;
    }
    if (end < start) {
      throw new Error(`Invalid range: end (${end + 1}) cannot be less than start (${start + 1})`);
    }
    const cache = cliArgs.cache !== false;
    console.log(`Downloading and processing XLSX with range ${start + 1}-${end + 1}...`);
    await downloadAndProcessXlsx({ rangeIndex: start, rangeEndIndex: end, cache });
  })();
}

export { closeSehatIndonesiaKuDb, downloadAndProcessXlsx, fixKemkesDataItem, getDbData, getExcelData, getSehatIndonesiaKuDb, parseXlsxFile, restartSehatIndonesiaKuDb, outPath as sehatindonesiakuDataPath, sehatindonesiakuPref, showHelp };
//# sourceMappingURL=sehatindonesiaku-data.js.map
//# sourceMappingURL=sehatindonesiaku-data.js.map