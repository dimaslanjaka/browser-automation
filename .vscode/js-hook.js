import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'url';

// Get the absolute path of the current script for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Set up common Node.js environment variables for ES modules
globalThis.__filename = __filename;
globalThis.__dirname = __dirname;

// Enhanced error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Add timestamp to console logs
// const originalLog = console.log;
// const originalError = console.error;
// const originalWarn = console.warn;

// console.log = (...args) => {
//   originalLog(`[${new Date().toISOString()}]`, ...args);
// };

// console.error = (...args) => {
//   originalError(`[${new Date().toISOString()}] ERROR:`, ...args);
// };

// console.warn = (...args) => {
//   originalWarn(`[${new Date().toISOString()}] WARN:`, ...args);
// };

// Print startup info
console.log('JavaScript hook loaded successfully');
console.log('Working directory:', process.cwd());
console.log('Node.js version:', process.version);
console.log('Environment:', process.env.NODE_ENV || 'development');
