import { LogEntry } from '../database/BaseLogDatabase.js';
import { DataItem, getExcelData, sehatindonesiakuDb } from './sehatindonesiaku-data.js';
import { getKehadiranData } from './sehatindonesiaku-kehadiran.js';
import { getRegistrasiData } from './sehatindonesiaku-registrasi.js';

// This file for development only

async function _main(callback: (...args: any[]) => any | Promise<any>) {
  await sehatindonesiakuDb.initialize();
  await callback();
  await sehatindonesiakuDb.close();
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

async function _debugHadirData() {
  const allData = await getKehadiranData();
  console.log(`Total records from Kehadiran: ${allData.length}`);
  for (const [index, item] of allData.entries()) {
    console.log(`[${index + 1}/${allData.length}] NIK: ${item.nik}`);
    console.log(`${item.nik} - ${item.nama}`);
    console.log(`\t-> registered: ${item.registered}`);
    console.log(`\t-> hadir: ${item.hadir}`);
  }
}

async function _debugData() {
  const allExcelData = await getExcelData();
  const allData = await sehatindonesiakuDb.getLogs<DataItem>();
  console.log(`Total records from Excel: ${allExcelData.length}`);
  console.log(`Total records from Database: ${allData.length}`);

  for (let index = 0; index < allData.length; index++) {
    const item = allData[index];
    const found = allExcelData.find((d) => d.nik === item.data.nik);
    if (found) {
      console.log(`[${index + 1}/${allData.length}] NIK: ${item.data.nik} - ${item.data.nama}`);
      console.log(`\t-> registered: ${item.data.registered}`);
      console.log(`\t-> hadir: ${item.data.hadir}`);
      console.log('');
    }
  }
}

async function _migrate() {
  const allData = await sehatindonesiakuDb.getLogs<DataItem>();
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
      await sehatindonesiakuDb.addLog(item);
      console.log(`${item.id} migrated`);
    }
  }
}

async function _testRegistrasiFilter() {
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

_main(async function () {
  console.log('all data');
  await _debugData();
  console.log('all registrasi data');
  await _debugRegistrasiData();
}).catch(console.error);
