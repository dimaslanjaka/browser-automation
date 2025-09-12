//
// Core modules
const path = require('node:path');
const childProcess = require('node:child_process');
const dotenv = require('dotenv');

// Polyfill TextEncoder/TextDecoder if missing
if (typeof global.TextEncoder === 'undefined' || typeof global.TextDecoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  if (typeof global.TextEncoder === 'undefined') global.TextEncoder = TextEncoder;
  if (typeof global.TextDecoder === 'undefined') global.TextDecoder = TextDecoder;
}

// Polyfill setImmediate if missing
if (typeof setImmediate === 'undefined') {
  global.setImmediate = (fn, ...args) => setTimeout(fn, 0, ...args);
}

// Set console to UTF-8 on Windows
if (process.platform === 'win32') {
  childProcess.execSync('chcp 65001', { stdio: 'ignore' });
}

// Load environment variables from .env file in project root
dotenv.config({ path: path.join(process.cwd(), '.env') });

// Enhanced error handling: exit on unhandled errors
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// --- Timestamped logging (optional, keep for later) ---
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

// --- Startup info ---
console.log('JavaScript hook (CommonJS) loaded successfully');
console.log('Working directory:', process.cwd());
console.log('Node.js version:', process.version);
console.log('Environment:', process.env.NODE_ENV || 'development');

// Set VITE_INSTANCE_ID for Vite (random per process)
process.env.VITE_INSTANCE_ID = Math.random().toString(36).substring(2, 15);
