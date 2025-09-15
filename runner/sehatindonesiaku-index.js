import ansiColors from 'ansi-colors';
import { spawnAsync } from 'cross-spawn';
import { SqlError } from 'mariadb';
import minimist from 'minimist';
import { array_shuffle, array_unique } from 'sbg-utility';
import { getPuppeteer, closeFirstTab, waitForDomStable } from '../puppeteer_utils.js';
import { noop, sleep } from '../utils-browser.js';
import { getSehatIndonesiaKuDb, getExcelData } from './sehatindonesiaku-data.js';
import { ErrorDataKehadiranNotFound, DataTidakSesuaiKTPError, PembatasanUmurError, UnauthorizedError, TanggalPemeriksaanError } from './sehatindonesiaku-errors.js';
import { processKehadiranData, searchNik, checkAlreadyHadir } from './sehatindonesiaku-kehadiran.js';
import { processRegistrasiData } from './sehatindonesiaku-registrasi.js';
import { enterSehatIndonesiaKu } from './sehatindonesiaku-utils.js';

const args = minimist(process.argv.slice(2), {
  boolean: ["help", "single", "shuffle", "priority"],
  alias: { h: "help", s: "single", sh: "shuffle", prior: "priority" },
  default: { single: false, shuffle: false, priority: false }
});
async function main() {
  var _a, _b, _c, _d;
  await spawnAsync("chcp", ["65001"]).catch(noop);
  const db = await getSehatIndonesiaKuDb();
  let needLogin = false;
  const { browser } = await getPuppeteer();
  browser.on("disconnected", () => {
    process.exit(0);
  });
  let allData = await getExcelData();
  if (args.shuffle) {
    allData = array_shuffle(allData);
  }
  if (args.single) {
    allData = allData.slice(0, 1);
  }
  for (let i = 0; i < allData.length; i++) {
    let pages = await browser.pages();
    while (pages.length > 3) {
      console.log(`Too many pages open (${pages.length}), closing oldest...`);
      await pages[0].close();
      await sleep(1e3);
      pages = await browser.pages();
    }
    const item = allData[i];
    if (!item.nik) {
      const msg = `NIK kosong pada index ${i}`;
      console.log(`\u26A0\uFE0F  ${msg}`);
      continue;
    }
    if (!item.tanggal_lahir) {
      const msg = `Tanggal Lahir kosong`;
      console.log(`\u26A0\uFE0F  ${item.nik} - ${msg}`);
      continue;
    }
    const dbItem = await db.getLogById(item.nik) ?? {};
    if (args.priority) {
      if (((_a = dbItem.data) == null ? void 0 : _a.hadir) && ((_b = dbItem.data) == null ? void 0 : _b.registered)) {
        allData.push(item);
        allData.splice(i, 1);
        i--;
        console.log(`\u{1F4DD} ${item.nik} - Already processed, moving to end of the list`);
        continue;
      }
    }
    if (((_c = dbItem.data) == null ? void 0 : _c.hadir) && ((_d = dbItem.data) == null ? void 0 : _d.registered)) {
      console.log(`\u{1F4DD} ${item.nik} - Already processed`);
      continue;
    }
    try {
      console.log(`\u{1F4DD} ${item.nik} - Checking login status`);
      await checkLoginStatus(await browser.newPage());
      await closeFirstTab(browser);
      console.log(`\u{1F50D} ${item.nik} - Checking registered status`);
      await checkRegisteredStatus(await browser.newPage(), item, db);
      await closeFirstTab(browser);
      console.log(`\u{1F4DD} ${item.nik} - Processing registration`);
      await processRegistrasiData(await browser.newPage(), item, db);
      console.log(`\u2705 ${item.nik} - ${ansiColors.green("Successfully registered")}`);
      await closeFirstTab(browser);
      console.log(`\u{1F4DD} ${item.nik} - Processing attendance`);
      await processKehadiranData(await browser.newPage(), item, db);
      console.log(`\u2705 ${item.nik} - ${ansiColors.green("Successfully processed attendance")}`);
      await closeFirstTab(browser);
    } catch (e) {
      const message = ((dbItem == null ? void 0 : dbItem.message) ?? "").split(",");
      if (e instanceof AlreadyHadir) {
        continue;
      } else if (e instanceof ErrorDataKehadiranNotFound) {
        console.error(`${item.nik} - Error: Data Kehadiran not found.`);
        message.push("Data Kehadiran not found");
        await db.addLog({
          id: item.nik,
          data: { ...item, hadir: false },
          message: array_unique(message).join(",")
        });
        continue;
      } else if (e instanceof DataTidakSesuaiKTPError) {
        console.warn(`${item.nik} - ${ansiColors.red("Data tidak sesuai KTP")}`);
        message.push("Data tidak sesuai KTP");
        await db.addLog({
          id: item.nik,
          message: array_unique(message).join(","),
          data: { registered: false, ...item }
        });
        continue;
      } else if (e instanceof PembatasanUmurError) {
        console.warn(`Pembatasan umur untuk NIK ${item.nik}:`);
        message.push("Pembatasan umur");
        await db.addLog({
          id: item.nik,
          message: array_unique(message).join(","),
          data: { registered: false, ...item }
        });
        continue;
      } else if (e instanceof UnauthorizedError) {
        needLogin = true;
        console.warn(
          `${ansiColors.redBright("Login required")}, please ${ansiColors.bold("login manually")} from opened browser. (close browser manual)`
        );
        break;
      } else if (e instanceof TanggalPemeriksaanError) {
        console.warn(`${item.nik} - ${ansiColors.red("Tanggal Pemeriksaan tidak valid")}: ${item.tanggal_pemeriksaan}`);
        message.push(`Tanggal Pemeriksaan tidak valid. ${item.tanggal_pemeriksaan}`);
        await db.addLog({
          id: item.nik,
          message: array_unique(message).join(","),
          data: { registered: false, ...item }
        });
        continue;
      } else if (e instanceof SqlError) {
        console.error(`SQL Error for NIK ${item.nik}:`, e.message);
        if ("sql" in e) {
          console.error("SQL:", e.sql);
        }
        console.error(e.stack);
        break;
      }
      console.error(`Error processing data for NIK ${item.nik}:`, e);
    }
  }
  if (!needLogin) {
    console.log("All items processed successfully");
    await browser.close();
    process.exit(0);
  }
}
async function checkLoginStatus(page) {
  if (!await enterSehatIndonesiaKu(page)) {
    throw new UnauthorizedError();
  }
}
async function checkRegisteredStatus(page, item, db) {
  await page.goto("https://sehatindonesiaku.kemkes.go.id/ckg-pendaftaran-individu", { waitUntil: "networkidle2" });
  await waitForDomStable(page, 500, 1e4);
  await searchNik(page, item.nik);
  if (await checkAlreadyHadir(page, item, db)) {
    const dbItem = await db.getLogById(item.nik) ?? {};
    const messages = ((dbItem == null ? void 0 : dbItem.message) ?? "").split(",");
    messages.push("Data sudah hadir");
    await db.addLog({
      id: item.nik,
      // Marked as hadir is same as already registered
      data: { ...item, hadir: true, registered: true },
      message: array_unique(messages).join(",")
    });
    throw new AlreadyHadir();
  }
}
class AlreadyHadir extends Error {
  constructor(message) {
    super(message);
    this.name = "AlreadyHadir";
  }
}
if (process.argv.some((arg) => /sehatindonesiaku-index\.(js|cjs|ts|mjs)$/.test(arg))) {
  main().catch(console.error);
}
//# sourceMappingURL=sehatindonesiaku-index.js.map
//# sourceMappingURL=sehatindonesiaku-index.js.map