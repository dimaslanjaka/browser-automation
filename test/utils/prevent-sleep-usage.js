/**
 * Example usage of the improved prevent-sleep utility
 * Demonstrates both Wake Lock API and mouse movement fallback
 */

import { keepAwake, isWakeLockSupported } from '../../src/utils/prevent-sleep.js';

// Example 1: Basic usage with automatic method detection
async function basicExample(page) {
  console.log('Starting keep-awake...');

  // Check if Wake Lock API is supported
  if (isWakeLockSupported()) {
    console.log('✅ Wake Lock API is supported');
  } else {
    console.log('⚠️ Wake Lock API not supported, will use mouse movement fallback');
  }

  // Start keeping the system awake
  const wakeController = await keepAwake(page);

  console.log(`Keep-awake active using method: ${wakeController.method}`);
  console.log(`Is active: ${wakeController.isActive}`);

  // Simulate some long-running work
  await new Promise((resolve) => setTimeout(resolve, 5000));

  // Release the wake lock when done
  await wakeController.release();
  console.log('Keep-awake released');
}

// Example 2: Usage in a long-running automation script
async function automationExample() {
  const puppeteer = require('puppeteer');

  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Start keep-awake before long automation
    const wakeController = await keepAwake(page);
    console.log(`🔋 Keep-awake started using: ${wakeController.method}`);

    // Your long-running automation tasks
    await page.goto('https://example.com');

    // Simulate a long-running process
    for (let i = 0; i < 10; i++) {
      console.log(`Processing step ${i + 1}/10...`);
      await page.waitForTimeout(2000);

      // The system will stay awake during this process
      console.log(`Keep-awake still active: ${wakeController.isActive}`);
    }

    // Clean up
    await wakeController.release();
    console.log('✅ Automation completed, keep-awake released');
  } finally {
    await browser.close();
  }
}

// Example 3: Manual control with error handling
async function manualControlExample(page) {
  let wakeController = null;

  try {
    wakeController = await keepAwake(page);

    // Monitor the wake lock status
    const checkStatus = setInterval(() => {
      if (wakeController) {
        console.log(`Status: ${wakeController.isActive ? 'Active' : 'Inactive'} (${wakeController.method})`);
      }
    }, 10000);

    // Do your work here
    await performLongRunningTask();

    clearInterval(checkStatus);
  } catch (error) {
    console.error('Error during automation:', error);
  } finally {
    // Always release the wake lock
    if (wakeController) {
      await wakeController.release();
      console.log('Keep-awake cleaned up');
    }
  }
}

async function performLongRunningTask() {
  // Simulate work that takes time
  return new Promise((resolve) => {
    setTimeout(resolve, 30000); // 30 seconds
  });
}

// Example 4: Browser environment usage (for web pages)
function browserExample() {
  // This would run in a browser context, not Node.js
  if (typeof window !== 'undefined') {
    console.log('Running in browser environment');

    // Mock page object for browser use
    const mockPage = {
      mouse: {
        move: async () => {
          // In browser, you might want to do something different
          // or just rely on the Wake Lock API
          console.log('Mouse move fallback (browser)');
        }
      }
    };

    // Use the keep-awake functionality
    keepAwake(mockPage).then((wakeController) => {
      console.log(`Browser keep-awake active: ${wakeController.method}`);

      // Set up a button to release it
      const releaseButton = document.createElement('button');
      releaseButton.textContent = 'Release Keep-Awake';
      releaseButton.onclick = () => wakeController.release();
      document.body.appendChild(releaseButton);
    });
  }
}

export { basicExample, automationExample, manualControlExample, browserExample };
