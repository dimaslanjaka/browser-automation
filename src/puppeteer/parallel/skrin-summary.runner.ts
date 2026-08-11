import Bluebird from 'bluebird';
import { loadCsvData } from '../../../data/index.js';
import { ExcelRowData } from '../../../globals.js';
import { getNumbersOnly } from '../../utils/index.js';
import { createSkrinDatabase } from '../../database/shared.js';

async function main() {
  const database = createSkrinDatabase();
  const data = await loadCsvData<ExcelRowData>();
  console.log('Loaded', data.length, 'rows from CSV data.');

  const processedData = await Bluebird.filter(data, async (data) => {
    const existing = await database.getLogById(getNumbersOnly(data.nik));
    return !(existing && existing.data);
  });
  console.log(`Processed ${processedData.length} rows.`);

  const all = await database.getLogs(() => true);
  console.log('Total entries in DB:', all.length);

  const withData = all.filter((l) => l.data && Object.keys(l.data).length > 0);
  console.log('Entries with data:', withData.length);

  const withStatus = all.filter((l) => l.data && l.data.status);
  console.log('Entries with status:', withStatus.length);

  const byStatus = {};
  all.forEach((l) => {
    const status = l.data?.status || 'no-data';
    byStatus[status] = (byStatus[status] || 0) + 1;
  });
  console.log('Breakdown by status:', byStatus);

  await database.close();
}

main().catch((err) => {
  console.error('Error in main function:', err);
  process.exit(1);
});
