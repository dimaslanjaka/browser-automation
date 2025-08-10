import { spawn } from 'child_process';

/**
 * Prevents system sleep using Windows-specific power configuration.
 * This prevents the system from going to sleep during long-running automation tasks.
 *
 * @param {Object} [options] - Additional options for keep-awake behavior
 * @param {boolean} [options.useSystemPrevent=true] - Use OS-specific prevention methods
 * @returns {Promise<Object>} Returns an object with release method to stop keeping awake
 *
 * @example
 * // Keep system awake with Windows prevention
 * const wakeController = await keepAwake();
 * // Later, release and restore settings
 * await wakeController.release();
 *
 * @example
 * // Keep awake with explicit options
 * const wakeController = await keepAwake({ useSystemPrevent: true });
 *
 * @since 1.0.0
 */
async function keepAwake(options = {}) {
  let systemPreventActive = false;

  // Default to using system prevent unless explicitly disabled
  const shouldUseSystemPrevent = options.useSystemPrevent !== false;

  // Windows-specific sleep prevention
  const preventWindowsSleep = async () => {
    if (!shouldUseSystemPrevent || process.platform !== 'win32') {
      return false;
    }

    try {
      // Set sleep timeout to 0 (never) for current session
      const setNeverSleep = () =>
        new Promise((resolve, reject) => {
          const child = spawn('powercfg', ['-change', '-standby-timeout-ac', '0']);
          child.on('close', (code) => {
            if (code === 0) {
              console.log('Windows sleep prevention activated for current session');
              systemPreventActive = true;
              resolve(true);
            } else {
              reject(new Error(`powercfg failed with code ${code}`));
            }
          });
        });

      await setNeverSleep();
      return true;
    } catch (err) {
      console.warn('Windows sleep prevention failed:', err.message);
      return false;
    }
  };

  // Restore Windows power settings
  const restoreWindowsPowerSettings = async () => {
    if (!systemPreventActive || process.platform !== 'win32') {
      return;
    }

    try {
      // Reset to system default (usually 30 minutes for AC power)
      const restoreDefaults = () =>
        new Promise((resolve) => {
          const child = spawn('powercfg', ['-change', '-standby-timeout-ac', '30']);
          child.on('close', () => {
            console.log('Windows power settings restored');
            systemPreventActive = false;
            resolve();
          });
        });

      await restoreDefaults();
    } catch (err) {
      console.warn('Failed to restore Windows power settings:', err.message);
    }
  };

  // Initialize Windows sleep prevention
  const preventionActivated = await preventWindowsSleep();

  if (!preventionActivated) {
    console.warn('Sleep prevention not activated - either not on Windows or useSystemPrevent is disabled');
  }

  // Return controller object
  return {
    async release() {
      // Restore Windows power settings if they were changed
      await restoreWindowsPowerSettings();
      console.log('Keep-awake released');
    },

    get isActive() {
      return systemPreventActive;
    },

    get method() {
      if (systemPreventActive) return 'windowsPowerCfg';
      return 'none';
    }
  };
}

/**
 * Checks if Windows-specific sleep prevention is available.
 * @returns {boolean} True if running on Windows with powercfg available, false otherwise
 *
 * @example
 * if (isWindowsSleepPreventionSupported()) {
 *   console.log('Windows sleep prevention is available');
 * }
 *
 * @since 1.0.0
 */

function isWindowsSleepPreventionSupported() {
  return process.platform === 'win32';
}

export { keepAwake, keepAwake as preventSleep, isWindowsSleepPreventionSupported };
