const dotenv = require('dotenv');
const path = require('node:path');

// Load environment variables from .env file
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Set up common Node.js environment variables (already available in CommonJS)
// globalThis.__filename = __filename;
// globalThis.__dirname = __dirname;

// Enhanced error handling
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Add timestamp to console logs (commented out by default)
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
console.log('JavaScript hook (CommonJS) loaded successfully');
console.log('Working directory:', process.cwd());
console.log('Node.js version:', process.version);
console.log('Environment:', process.env.NODE_ENV || 'development');

// Set VITE_INSTANCE_ID for Vite
process.env.VITE_INSTANCE_ID = Math.random().toString(36).substring(2, 15);
