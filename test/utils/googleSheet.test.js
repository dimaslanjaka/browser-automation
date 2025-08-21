import { downloadSheets } from '../../src/utils/googleSheet';
import fs from 'fs-extra';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

describe('downloadSheets', () => {
  const filesToDelete = [];
  const spreadsheetIds = [
    // {
    //   env: 'SPREADSHEET_ID',
    //   label: 'default spreadsheet',
    //   id: process.env.SPREADSHEET_ID
    // },
    // {
    //   env: 'KEMKES_SPREADSHEET_ID',
    //   label: 'kemkes spreadsheet',
    //   id: process.env.KEMKES_SPREADSHEET_ID
    // },
    {
      env: 'HARDCODED_1',
      label: 'hardcoded sheet 1',
      id: '1ZeKNK65lBt4mveCFxydo-9wifc01g0OTWFbXO9o3kR8'
    },
    {
      env: 'HARDCODED_2',
      label: 'hardcoded sheet 2',
      id: '1a4j7cKIB27sV7TWrhAI2VwW3WHdjNqLO'
    },
    {
      env: 'HARDCODED_3',
      label: 'hardcoded sheet 3',
      id: '1o1K9_qWfLKQIoCCrkGgyHmQ9a0Sn8d5D'
    }
  ];
  const CACHE_DIR = path.join(process.cwd(), '.cache', 'sheets');

  beforeAll(() => {
    fs.ensureDirSync(CACHE_DIR);
  });

  afterAll(() => {
    // Cleanup downloaded XLSX and CSV files for all tested spreadsheet IDs
    filesToDelete.forEach((filePath) => {
      if (fs.existsSync(filePath)) {
        fs.removeSync(filePath);
        console.log(`Removed cached file: ${filePath}`);
      }
    });
  });

  spreadsheetIds.forEach(({ env, label, id }) => {
    it(
      `downloads and caches the ${label}, and exports CSVs [${env}]`,
      async () => {
        if (!id) {
          throw new Error(`${env} not set in .env`);
        }
        const { xlsxFilePath, csvFiles, xlsxMetadataPath } = await downloadSheets(id);
        filesToDelete.push(xlsxFilePath, ...csvFiles, xlsxMetadataPath);
        expect(xlsxFilePath).toBeTruthy();
        expect(fs.existsSync(xlsxFilePath)).toBe(true);
        expect(Array.isArray(csvFiles)).toBe(true);
        expect(csvFiles.length).toBeGreaterThan(0);
        for (const csvPath of csvFiles) {
          expect(fs.existsSync(csvPath)).toBe(true);
        }
      },
      60 * 1000
    );
  });
});
