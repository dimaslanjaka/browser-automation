'use strict';

require('../chunk-4IBVXDKH.cjs');
var child_process = require('child_process');

async function keepAwake(options = {}) {
  let systemPreventActive = false;
  const shouldUseSystemPrevent = options.useSystemPrevent !== false;
  const preventWindowsSleep = async () => {
    if (!shouldUseSystemPrevent || process.platform !== "win32") {
      return false;
    }
    try {
      const setNeverSleep = () => new Promise((resolve, reject) => {
        const child = child_process.spawn("powercfg", ["-change", "-standby-timeout-ac", "0"]);
        child.on("close", (code) => {
          if (code === 0) {
            console.log("Windows sleep prevention activated for current session");
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
      console.warn("Windows sleep prevention failed:", err.message);
      return false;
    }
  };
  const restoreWindowsPowerSettings = async () => {
    if (!systemPreventActive || process.platform !== "win32") {
      return;
    }
    try {
      const restoreDefaults = () => new Promise((resolve) => {
        const child = child_process.spawn("powercfg", ["-change", "-standby-timeout-ac", "30"]);
        child.on("close", () => {
          console.log("Windows power settings restored");
          systemPreventActive = false;
          resolve();
        });
      });
      await restoreDefaults();
    } catch (err) {
      console.warn("Failed to restore Windows power settings:", err.message);
    }
  };
  const preventionActivated = await preventWindowsSleep();
  if (!preventionActivated) {
    console.warn("Sleep prevention not activated - either not on Windows or useSystemPrevent is disabled");
  }
  return {
    async release() {
      await restoreWindowsPowerSettings();
      console.log("Keep-awake released");
    },
    get isActive() {
      return systemPreventActive;
    },
    get method() {
      if (systemPreventActive) return "windowsPowerCfg";
      return "none";
    }
  };
}
function isWindowsSleepPreventionSupported() {
  return process.platform === "win32";
}

exports.isWindowsSleepPreventionSupported = isWindowsSleepPreventionSupported;
exports.keepAwake = keepAwake;
exports.preventSleep = keepAwake;
//# sourceMappingURL=prevent-sleep.cjs.map
//# sourceMappingURL=prevent-sleep.cjs.map