import express from 'express';
import nunjucks from 'nunjucks';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM-friendly __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Testing Nunjucks template configuration...');

try {
  const app = express();

  // Configure Nunjucks
  const templatesDir = path.join(__dirname, '..', 'templates');
  const env = nunjucks.configure(templatesDir, {
    autoescape: true,
    express: app,
    watch: true
  });

  // Add custom filters
  env.addFilter('number', function(num) {
    if (typeof num !== 'number') {
      return num;
    }
    return num.toLocaleString();
  });

  console.log('✓ Nunjucks configuration successful');

  // Test rendering a simple template
  const testData = {
    filename: 'test.xlsx',
    sheetNames: ['Sheet1'],
    sheets: [{
      name: 'Sheet1',
      totalRows: 1000,
      currentPage: 1,
      totalPages: 10,
      limit: 100,
      isLimited: true,
      htmlTable: '<table><tr><td>Test</td></tr></table>'
    }],
    pagination: {
      hasLargeData: true,
      limit: 100
    }
  };

  const rendered = nunjucks.render('xlsx-viewer.njk', testData);
  console.log('✓ Template rendering successful');
  console.log('✓ All tests passed - server should work correctly');

} catch (error) {
  console.error('✗ Error during template test:', error.message);
  process.exit(1);
}
