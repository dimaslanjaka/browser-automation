import Bluebird from 'bluebird';
import { loadCsvData } from '../../../data/index.js';
import { ExcelRowData } from '../../../globals.js';
import { getNumbersOnly } from '../../utils/index.js';
import { createSkrinDatabase } from '../../database/shared.js';

async function main() {
  const database = createSkrinDatabase();
  const data = await loadCsvData<ExcelRowData>();
  console.log(`Loaded ${data.length} rows from CSV data.`);

  const processedData = await Bluebird.filter(data, async (data) => {
    const existing = await database.getLogById(getNumbersOnly(data.nik));
    return !(existing && existing.data);
  });
  console.log(`Processed ${processedData.length} rows.`);

  await database.close();
}

main().catch((err) => {
  console.error('Error in main function:', err);
  process.exit(1);
});
