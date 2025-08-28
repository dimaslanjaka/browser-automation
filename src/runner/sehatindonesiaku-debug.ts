import { LogEntry } from '../database/BaseLogDatabase.js';
import { DataItem, sehatindonesiakuDb } from './sehatindonesiaku-data.js';
import { getKehadiranData } from './sehatindonesiaku-kehadiran.js';
import { getRegistrasiData } from './sehatindonesiaku-registrasi.js';

// This file for development only

async function _main(callback: (...args: any[]) => any | Promise<any>) {
  await sehatindonesiakuDb.initialize();
  await callback();
  await sehatindonesiakuDb.close();
}

async function _debugKemkesData() {
  const allData = await getRegistrasiData();
  console.log(`Total records from Kemkes: ${allData.length}`);
  for (const [index, item] of allData.entries()) {
    const get = await sehatindonesiakuDb.getLogById<DataItem>(item.nik);
    console.log(`[${index + 1}/${allData.length}] NIK: ${item.nik} - Existing: ${get ? 'Yes' : 'No'}`);
    if (get) {
      console.log(`${get.data.nik} - ${get.data.nama}`);
      console.log(`\t-> registered: ${get.data.registered}`);
      console.log(`\t-> hadir: ${get.data.hadir}`);
    }
  }
}

async function _debugHadirData() {
  const allData = await getKehadiranData();
  console.log(`Total records from Kehadiran: ${allData.length}`);
  for (const [index, item] of allData.entries()) {
    const get = await sehatindonesiakuDb.getLogById<DataItem>(item.nik);
    console.log(`[${index + 1}/${allData.length}] NIK: ${item.nik} - Existing: ${get ? 'Yes' : 'No'}`);
    if (get) {
      console.log(`${get.data.nik} - ${get.data.nama}`);
      console.log(`\t-> registered: ${get.data.registered}`);
      console.log(`\t-> hadir: ${get.data.hadir}`);
    }
  }
}

async function _migrate() {
  const allData = await sehatindonesiakuDb.getLogs<DataItem>();
  for (const item of allData as LogEntry<DataItem>[]) {
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
      await sehatindonesiakuDb.addLog(item);
      console.log(`${item.id} migrated`);
    }
  }
}

async function _testKemkesFilter() {
  // test register 3173050212880001
  // kemkes --nik=3173050212880001
  // Test filtering by NIK
  const nik = '3173050212880001';
  process.argv.push(`--nik=${nik}`);
  const { getRegistrasiData: getKemkesData } = await import('./sehatindonesiaku-registrasi.js');
  const allData = await getKemkesData();
  const filteredData = allData.filter((item) => item.nik === nik);
  console.log(`Filtered results for NIK ${nik}:`, filteredData);
}

_main(_debugHadirData).catch(console.error);
