import fixData from '../src/utils/xlsx/fixData.js';

// ========== NODE.JS EXIT INSPECTION UTILITIES ==========

/**
 * Logs all active handles that prevent Node.js from exiting
 */
function logActiveHandles() {
  console.log('\n=== ACTIVE HANDLES INSPECTION ===');

  // Get active handles (timers, sockets, etc.)
  if (process._getActiveHandles) {
    const handles = process._getActiveHandles();
    console.log(`Active handles count: ${handles.length}`);
    handles.forEach((handle, index) => {
      console.log(`Handle ${index + 1}:`, {
        constructor: handle.constructor.name,
        type: handle._type || 'unknown',
        destroyed: handle.destroyed || false,
        ref: handle._handle ? handle._handle.hasRef() : 'unknown'
      });
    });
  }

  // Get active requests
  if (process._getActiveRequests) {
    const requests = process._getActiveRequests();
    console.log(`Active requests count: ${requests.length}`);
    requests.forEach((request, index) => {
      console.log(`Request ${index + 1}:`, {
        constructor: request.constructor.name,
        type: request._type || 'unknown'
      });
    });
  }
}

/**
 * Sets up monitoring for process exit behavior
 */
function setupExitMonitoring() {
  console.log('Setting up exit monitoring...');

  // Monitor process events
  process.on('beforeExit', (code) => {
    console.log('\n=== BEFORE EXIT EVENT ===');
    console.log(`Before exit with code: ${code}`);
    logActiveHandles();
  });

  process.on('exit', (code) => {
    console.log(`\n=== EXIT EVENT ===`);
    console.log(`Process exiting with code: ${code}`);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('\n=== UNCAUGHT EXCEPTION ===');
    console.error('Uncaught Exception:', error);
    logActiveHandles();
    process.exit(1);
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('\n=== UNHANDLED REJECTION ===');
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    logActiveHandles();
    process.exit(1);
  });
}

/**
 * Force exit if script doesn't terminate naturally within timeout
 * @param {number} timeoutMs - Timeout in milliseconds (default: 10 seconds)
 */
function forceExitAfterTimeout(timeoutMs = 10000) {
  const timeout = setTimeout(() => {
    console.log('\n=== FORCE EXIT TIMEOUT ===');
    console.log(`Script didn't exit naturally within ${timeoutMs}ms`);
    logActiveHandles();
    console.log('Forcing exit...');
    process.exit(0);
  }, timeoutMs);

  // Unref the timeout so it doesn't keep the process alive
  timeout.unref();

  return timeout;
}

/**
 * Attempt graceful shutdown by clearing common handle types
 */
function attemptGracefulShutdown() {
  console.log('\n=== ATTEMPTING GRACEFUL SHUTDOWN ===');

  // Clear all timers
  const timers = process._getActiveHandles
    ? process._getActiveHandles().filter((h) => h.constructor.name === 'Timeout' || h.constructor.name === 'Immediate')
    : [];

  timers.forEach((timer) => {
    if (timer.close && typeof timer.close === 'function') {
      timer.close();
    }
    if (timer.unref && typeof timer.unref === 'function') {
      timer.unref();
    }
  });

  console.log(`Attempted to clear ${timers.length} timers`);
}

// Initialize exit monitoring
setupExitMonitoring();

// Set up force exit timeout
const forceExitTimeout = forceExitAfterTimeout(10000);

// ========== ORIGINAL TEST CODE ==========

/** @type {import('../globals.js').ExcelRowData} */
const _excelRowData = {
  rowIndex: 1,
  tanggal: '15/01/2025',
  nama: 'Sample Name',
  nik: '1234567890123456', // 16 characters
  pekerjaan: 'Engineer',
  bb: 70,
  tb: 170,
  batuk: 'Tidak',
  diabetes: 'Tidak',
  alamat: 'Jl. Sample Street No. 123'
};

/** @type {import('../globals.js').ExcelRowData4} */
const _excelRowData4 = {
  'TANGGAL ENTRY': '16/01/2025',
  'NAMA PASIEN': 'Another Name',
  'NIK PASIEN': '9876543210987654',
  PEKERJAAN: 'Doctor',
  BB: 65,
  TB: 165,
  ALAMAT: 'Jl. Another Street No. 456',
  'TGL LAHIR': '01/01/1990',
  'PETUGAS ENTRY': 'Admin User',
  NAMA: 'Another Name',
  NIK: '9876543210987654',
  originalRowNumber: 2
};

// ========== MAIN EXECUTION ==========
async function main() {
  try {
    console.log('=== STARTING FIXDATA TESTS ===');

    const result = fixData(_excelRowData);
    console.log('Result for _excelRowData:', result);

    const result4 = fixData(_excelRowData4);
    console.log('Result for _excelRowData4:', result4);

    console.log('\n=== TESTS COMPLETED ===');

    // Log current state before attempting exit
    console.log('\n=== PRE-EXIT STATE CHECK ===');
    logActiveHandles();

    // Attempt graceful shutdown
    attemptGracefulShutdown();

    // Clear the force exit timeout since we're done
    if (forceExitTimeout) {
      clearTimeout(forceExitTimeout);
    }

    console.log('Script execution completed. Checking if process exits naturally...');

    // Set a shorter timeout to detect if process hangs
    setTimeout(() => {
      console.log('\n=== PROCESS HANGING DETECTED ===');
      console.log('Process did not exit naturally after completion');
      logActiveHandles();
      process.exit(0);
    }, 2000).unref();
  } catch (error) {
    console.error('Error in main execution:', error);
    logActiveHandles();
    process.exit(1);
  }
}

// Run the main function
main();
