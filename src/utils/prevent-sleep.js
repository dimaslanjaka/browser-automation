/**
 * Keeps a browser page awake using the Screen Wake Lock API when available,
 * with fallback to mouse movement for Puppeteer automation tasks.
 * This prevents the system from going to sleep or becoming idle during long-running automation tasks.
 *
 * @param {Object} page - The Puppeteer page object that provides mouse control
 * @param {Object} page.mouse - The mouse object with move method
 * @param {Function} page.mouse.move - Function to move mouse to specified coordinates
 * @returns {Promise<Object>} Returns an object with release method to stop keeping awake
 *
 * @example
 * // Keep a Puppeteer page awake
 * const page = await browser.newPage();
 * const wakeController = await keepAwake(page);
 * // Later, release the wake lock
 * await wakeController.release();
 *
 * @since 1.0.0
 */
async function keepAwake(page) {
  let wakeLock = null;
  let usingMouseMovement = false;
  let visibilityHandler = null;

  // Try to use the Wake Lock API first (for browser environments)
  const tryWakeLock = async () => {
    try {
      // Check if Wake Lock API is supported
      if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
        wakeLock = await navigator.wakeLock.request('screen');
        console.log('Screen Wake Lock acquired successfully');

        // Listen for wake lock release
        wakeLock.addEventListener('release', () => {
          console.log('Screen Wake Lock has been released');
          wakeLock = null;
        });

        return true;
      }
    } catch (err) {
      console.warn('Wake Lock API failed:', err.message);
      wakeLock = null;
    }
    return false;
  };

  // Fallback mouse movement for Puppeteer
  const startMouseMovement = async () => {
    try {
      await page.mouse.move(1, 1);
      await page.mouse.move(2, 2);
      // console.log('Sent keep-alive mouse move.');
      usingMouseMovement = true;
    } catch (err) {
      console.error('Keep-awake mouse error:', err);
    }
  };

  // Handle visibility change to reacquire wake lock
  const handleVisibilityChange = async () => {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !wakeLock) {
      await tryWakeLock();
    }
  };

  // Initialize wake keeping
  const wakeLockAcquired = await tryWakeLock();

  if (!wakeLockAcquired) {
    console.log('Using mouse movement fallback for keep-awake');
    await startMouseMovement();
  }

  // Set up visibility change listener for wake lock reacquisition
  if (typeof document !== 'undefined') {
    visibilityHandler = handleVisibilityChange;
    document.addEventListener('visibilitychange', visibilityHandler);
  }

  // Return controller object
  return {
    async release() {
      // Release wake lock
      if (wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
      if (usingMouseMovement) {
        // If using mouse movement, we don't need to do anything special
        usingMouseMovement = false;
      }

      // Clear mouse movement interval (no longer needed since we don't use intervals)
      // mouseInterval cleanup removed as we no longer use intervals

      // Remove visibility change listener
      if (visibilityHandler && typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', visibilityHandler);
        visibilityHandler = null;
      }

      console.log('Keep-awake released');
    },

    get isActive() {
      return wakeLock !== null;
    },

    get method() {
      if (wakeLock) return 'wakeLock';
      if (usingMouseMovement) return 'mouseMovement';
      return 'none';
    }
  };
}

/**
 * Checks if the Screen Wake Lock API is supported in the current environment.
 * @returns {boolean} True if Wake Lock API is supported, false otherwise
 *
 * @example
 * if (isWakeLockSupported()) {
 *   console.log('Wake Lock API is available');
 * } else {
 *   console.log('Wake Lock API not supported, will use fallback');
 * }
 *
 * @since 1.0.0
 */
function isWakeLockSupported() {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

export { keepAwake, keepAwake as preventSleep, isWakeLockSupported };
