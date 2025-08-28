import { LogEntry } from '../database/BaseLogDatabase.js';
import { DataItem, sehatindonesiakuDb } from './sehatindonesiaku-data.js';
import { getKemkesData } from './sehatindonesiaku-kemkes.js';

// This file for development only

async function _main(callback: (...args: any[]) => any | Promise<any>) {
  await sehatindonesiakuDb.initialize();
  await callback();
  await sehatindonesiakuDb.close();
}

async function _debugSingle() {
  const allData = await getKemkesData();
  console.log(`Total records from Kemkes: ${allData.length}`);
  for (const [index, item] of allData.entries()) {
    const get = await sehatindonesiakuDb.getLogById(item.nik);
    console.log(`[${index + 1}/${allData.length}] NIK: ${item.nik} - Existing: ${get ? 'Yes' : 'No'}`);
    if (get) {
      console.log(get);
      break;
    }
  }
}

async function _migrate() {
  const allData = await sehatindonesiakuDb.getLogs<DataItem>();
  for (const item of allData as LogEntry<DataItem>[]) {
    if ('status' in item.data) {
      if (item.data.status === 'success') {
        item.data.registered = true;
      } else {
        item.data.registered = false;
      }
      delete item.data.status;
      await sehatindonesiakuDb.addLog(item);
      console.log(`${item.id} migrated`);
    }
  }
}

// _main(_migrate).catch(console.error);
