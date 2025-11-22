import * as data from '../data/index.js';
import fixData from '../src/utils/xlsx/fixData.js';

(async () => {
  console.log('Loading CSV data...');
  const csvData = await data.loadCsvData();
  // console.log(`Loaded ${csvData.length} records from CSV.`);
  // console.log(csvData.at(0)); // Output the first mapped record to verify mapping
  // console.log(csvData.at(-1)); // Output the last mapped record to verify mapping
  const fix = await fixData(csvData.at(0));
  console.log(fix);
})();
