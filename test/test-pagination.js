import nunjucks from 'nunjucks';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Testing enhanced pagination template...');

try {
  const templatesDir = path.join(__dirname, '..', 'templates');
  const env = nunjucks.configure(templatesDir, {
    autoescape: true,
    watch: false
  });

  // Add custom filters
  env.addFilter('number', function(num) {
    if (typeof num !== 'number') {
      return num;
    }
    return num.toLocaleString();
  });

  const testData = {
    filename: 'test.xlsx',
    sheetNames: ['Sheet1'],
    sheets: [{
      name: 'Sheet1',
      totalRows: 5000,
      currentPage: 2,
      totalPages: 50,
      limit: 100,
      isLimited: true,
      htmlTable: '<table><tr><td>Test Data</td></tr></table>'
    }],
    pagination: {
      currentPage: 2,
      limit: 100,
      totalPages: 50,
      hasLargeData: true
    }
  };

  console.log('Rendering template with enhanced pagination...');
  const rendered = nunjucks.render('xlsx-viewer.njk', testData);

  // Check if it contains the pagination links
  const hasFirstLink = rendered.includes('⏮️ First Page');
  const hasLastLink = rendered.includes('⏭️ Last Page');
  const hasPreviousLink = rendered.includes('⬅️ Previous');
  const hasNextLink = rendered.includes('➡️ Next');

  console.log('✓ Template rendered successfully');
  console.log(`✓ Contains First Page link: ${hasFirstLink}`);
  console.log(`✓ Contains Last Page link: ${hasLastLink}`);
  console.log(`✓ Contains Previous link: ${hasPreviousLink}`);
  console.log(`✓ Contains Next link: ${hasNextLink}`);

  if (hasFirstLink && hasLastLink && hasPreviousLink && hasNextLink) {
    console.log('🎉 All pagination links are working correctly!');
  } else {
    console.log('⚠️ Some pagination links may be missing');
  }

} catch (error) {
  console.error('✗ Error during template test:', error.message);
  console.error(error.stack);
}
