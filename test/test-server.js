import { spawn } from 'child_process';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

// ESM-friendly __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('Starting server test...');

// Start the server
const serverPath = path.join(__dirname, '..', 'xlsx-web-server.js');
const rootDir = path.join(__dirname, '..');
console.log('Server path:', serverPath);
console.log('Working directory:', rootDir);
const serverProcess = spawn('node', [serverPath], {
  stdio: 'pipe',
  cwd: rootDir
});

let serverOutput = '';
serverProcess.stdout.on('data', (data) => {
  serverOutput += data.toString();
});

serverProcess.stderr.on('data', (data) => {
  console.error('Server error:', data.toString());
});

// Test the server after a short delay
setTimeout(async () => {
  try {
    console.log('Testing server connection...');
    const response = await fetch('http://localhost:3000');
    console.log(`✓ Server responding with status: ${response.status}`);

    if (response.status === 200) {
      console.log('✓ Server is working correctly!');
    } else {
      console.log('⚠️ Server returned non-200 status');
    }

  } catch (error) {
    console.error('✗ Failed to connect to server:', error.message);
  } finally {
    // Kill the server
    serverProcess.kill('SIGTERM');
    console.log('Server stopped');
    process.exit(0);
  }
}, 3000);

// Handle server startup
setTimeout(() => {
  if (serverOutput.includes('Server running') || serverOutput.includes('listening')) {
    console.log('✓ Server started successfully');
  } else {
    console.log('⚠️ Server might not have started correctly');
    console.log('Server output:', serverOutput);
  }
}, 2000);
