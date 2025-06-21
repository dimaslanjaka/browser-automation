import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writefile } from 'sbg-utility';
import { generateHTML, parseLogFile } from './log-builder.js';
import { newLogPath } from './skrin.log-restart.js';

// Define __filename and __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env') });

if (process.argv[1] === __filename) {
  (async function () {
    const publicDir = path.join(process.cwd(), 'public');
    // Parse log data and generate HTML output
    const logs = parseLogFile(newLogPath);
    const generatedHtml = await generateHTML(logs);
    const publicFileName = 'new-log-' + logs.at(0).minIndex + '-' + process.env.index_end + '.html';
    const publicFilePath = path.join(publicDir, publicFileName);
    writefile(publicFilePath, generatedHtml);
    console.log(`✅ Minified HTML file generated: ${publicFilePath}.`);
  })();
}
