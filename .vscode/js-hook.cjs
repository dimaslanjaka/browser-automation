/* eslint-disable no-global-assign */
/* eslint-disable no-redeclare */
const dotenv = require('dotenv');
const path = require('node:path');
const childProcess = require('node:child_process');
// Only require TextEncoder/TextDecoder from 'util' if not already global
let TextEncoder = global.TextEncoder;
let TextDecoder = global.TextDecoder;
if (typeof TextEncoder === 'undefined' || typeof TextDecoder === 'undefined') {
  ({ TextEncoder, TextDecoder } = require('util'));
}

// Set console to UTF-8 on Windows
if (process.platform === 'win32') {
  childProcess.execSync('chcp 65001', { stdio: 'ignore' });
}

// Load environment variables from .env file
dotenv.config({ path: path.join(process.cwd(), '.env') });

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}
if (typeof setImmediate === 'undefined') {
  global.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
}

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
