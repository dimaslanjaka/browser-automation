import fs from 'fs-extra';
import path from 'path';
import { LogEntry } from '../database/BaseLogDatabase.js';
import { getKehadiranData } from './sehatindonesiaku-kehadiran.js';
import { getRegistrasiData } from './sehatindonesiaku-registrasi.js';
import { DataItem, DebugItem } from './types.js';
import { getSehatIndonesiaKuDb } from './sehatindonesiaku-data.js';
import { LogDatabase } from '../database/LogDatabase.js';

// This file for development only

const logFile = path.join(process.cwd(), 'tmp/logs/debug.log');
// reset log
fs.ensureDirSync(path.dirname(logFile));
fs.writeFileSync(logFile, '');
const _log = console.log;
const _error = console.error;

console.log = (...args: any[]) => {
  _log(...args);
  const map = args.map((arg) => {
    if (typeof arg === 'object') {
      return JSON.stringify(arg);
    } else if (typeof arg === 'boolean') {
      return arg ? 'true' : 'false';
    }
    return arg;
  });
  fs.appendFileSync(logFile, `${map.join(' ')}\n`);
};

console.error = (...args: any[]) => {
  _error(...args);
  const map = args.map((arg) => {
    if (typeof arg === 'object') {
      return JSON.stringify(arg);
    } else if (typeof arg === 'boolean') {
      return arg ? 'true' : 'false';
    }
    return arg;
  });
  fs.appendFileSync(logFile, `[ERROR] ${map.join(' ')}\n`);
};

async function _main(callback: (db: Awaited<ReturnType<typeof getSehatIndonesiaKuDb>>) => any | Promise<any>) {
  const db = await getSehatIndonesiaKuDb();
  await callback(db);
  await db.close();
}

async function _debugRegistrasiData() {
  const allData = await getRegistrasiData({ debug: true });
  console.log(`Total records from Registrasi: ${allData.length}`);
  for (const [index, item] of allData.entries()) {
    console.log(`[${index + 1}/${allData.length}] NIK: ${item.nik}`);
    console.log(`${item.nik} - ${item.nama}`);
    console.log(`\t-> registered: ${item.registered}`);
    console.log(`\t-> hadir: ${item.hadir}`);
  }
}

async function _debugHadirData(db: LogDatabase) {
  const allData = await getKehadiranData(db);
  console.log(`Total records from Kehadiran: ${allData.length}`);
  for (const [index, item] of allData.entries()) {
    console.log(`[${index + 1}/${allData.length}] NIK: ${item.nik}`);
    console.log(`${item.nik} - ${item.nama}`);
    console.log(`\t-> registered: ${item.registered}`);
    console.log(`\t-> hadir: ${item.hadir}`);
  }
}

async function _debugData(db, options?: { nik?: string }) {
  const { getExcelData } = await import('./sehatindonesiaku-data.js');
  const allExcelData: DataItem[] = await getExcelData();
  const allDbData = (await db.getLogs()) as LogEntry<DataItem>[];

  console.log(`Total records from Excel: ${allExcelData.length}`);
  console.log(`Total records from Database: ${allDbData.length}`);

  // Merge excel + db records with type tags (typed as DebugItem)
  let allData = [
    ...allExcelData.map((item) => ({ ...item, type: 'excel' as const })),
    ...allDbData.map((log) => ({ ...log.data, type: 'db' as const }))
  ].filter((item) => {
    // Non-empty object
    return item && Object.keys(item).length > 0;
  }) as DebugItem[];

  // Filter by NIK if requested
  if (options?.nik) {
    allData = allData.filter((item) => item.nik === options.nik);

    if (allData.length === 0) {
      console.log(`No data found for NIK ${options.nik}`);
      return;
    }

    console.log(`Filtered results for NIK ${options.nik}:`, allData);
  }

  // Print details
  allData.forEach((item, index) => {
    const foundInExcel = allExcelData.some((d) => d.nik === item.nik);
    if (!foundInExcel) return;

    console.log(`[${index + 1}/${allData.length}] NIK: ${item.nik} - ${item.nama}`);
    console.log(`\t-> from: ${item.type}`);
    console.log(`\t-> registered: ${item.registered}`);
    console.log(`\t-> hadir: ${item.hadir}\n`);
  });
}

async function _testRegistrasiFilter(db) {
  // test register 3173050212880001
  // kemkes --nik=3173050212880001
  // 3173055301750007 - data tidak sesuai KTP
  // 3173052509010005 - sukses
  // 3173056206040006 - data kuota penuh pada tanggal tertentu
  // Test filtering by NIK
  const nik = `3173055605081003`;
  process.argv.push(`--nik=${nik.trim()}`);
  await _debugData(db, { nik });
}

_main(async function (db) {
  // console.log('all data');
  // await _debugData(db);
  // console.log('all registrasi data');
  // await _debugRegistrasiData();
  // console.log('all hadir data');
  // await _debugHadirData();
  await _testRegistrasiFilter(db);
  // await _migrate(db);
})
  .catch(console.error)
  .finally(() => {
    _log(`Log saved ${logFile}`);
  });

async function _migrate(db) {
  const allData = (await db.getLogs()) as LogEntry<DataItem>[];
  for (let i = 0; i < (allData as LogEntry<DataItem>[]).length; i++) {
    const item = (allData as LogEntry<DataItem>[])[i];
    process.stdout.write(`\rProcessing [${i + 1}/${(allData as LogEntry<DataItem>[]).length}] ${item.id}... `);
    if ('status' in item.data) {
      if (!('registered' in item.data)) {
        // Set default value for registered
        if (item.data.status === 'success') {
          item.data.registered = true;
        } else {
          item.data.registered = false;
        }
      }
      delete item.data.status;
      await db.addLog(item);
      console.log(`${item.id} migrated`);
    }
  }
}
