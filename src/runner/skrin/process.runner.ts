import Bluebird from 'bluebird';
import { array_shuffle, scheduler } from 'sbg-utility';
import path from 'upath';
import { loadCsvData } from '../../../data/index.js';
import { LogDatabase } from '../../database/LogDatabase.js';
import { toValidMySQLDatabaseName } from '../../database/db_utils.js';
import getPuppeteerWithParallel from '../../puppeteer/parallel/getPuppeteerWithParallel.js';
import setupXhrCapture from '../../puppeteer/xhr/capture-xhr.js';
import { getNumbersOnly } from '../../utils-browser.js';
import { processData } from './direct-process-data.js';

scheduler.register();

const { MYSQL_HOST, MYSQL_USER, MYSQL_PASS, MYSQL_PORT } = process.env;
const database = new LogDatabase(toValidMySQLDatabaseName('skrin_' + process.env.DATABASE_FILENAME), {
  connectTimeout: 60000,
  connectionLimit: 10,
  host: MYSQL_HOST || 'localhost',
  user: MYSQL_USER || 'root',
  password: MYSQL_PASS || '',
  port: Number(MYSQL_PORT) || 3306,
  type: MYSQL_HOST ? 'mysql' : 'sqlite'
});
export { database as skrinDatabase };

async function main() {
  const { page, release } = await getPuppeteerWithParallel();

  const baseDir = path.join(process.cwd(), 'tmp/puppeteer/xhr');
  const _stopCapture = setupXhrCapture(page, { baseDir });

  const dataKunto = await Bluebird.filter(await loadCsvData(), async (data) => {
    const existing = await database.getLogById(getNumbersOnly(data.nik));
    if (existing && existing.data) return false;
    return true;
  }).then((data) => {
    if (data.length === 0) {
      return loadCsvData(); // if all data is already in database, reload without filtering to process at least one entry
    }
    return data;
  });

  const data = array_shuffle(dataKunto).shift();
  const result = await processData(page, data, database, {
    skipValidateDb: true,
    skipCurrentMonthValidation: true
  }).catch((err) => {
    console.error('Error processing data:', err);
    return { status: 'error', error: err.message || String(err) };
  });

  if (result.status !== 'success') {
    console.warn('Unexpected result status:', result.status, result);
    process.exit(1); // exit on unexpected status to avoid silent failures
  } else {
    console.log(result);
  }

  _stopCapture();
  release();
}

if (process.argv.some((arg) => arg.includes('process.runner'))) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
