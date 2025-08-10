/**
 * Test file for prevent-sleep utilities
 */

import { keepAwake, isWindowsSleepPreventionSupported } from '../src/utils/prevent-sleep.js';

describe('Prevent Sleep Utilities', () => {
  test('should check Windows sleep prevention support', () => {
    const isSupported = isWindowsSleepPreventionSupported();
    expect(typeof isSupported).toBe('boolean');
    console.log('Windows sleep prevention supported:', isSupported);

    if (process.platform === 'win32') {
      expect(isSupported).toBe(true);
    }
  });

  test('should handle keepAwake with default options', async () => {
    // Test with default options (Windows prevention enabled)
    const controller = await keepAwake();
    expect(controller).toBeDefined();
    expect(typeof controller.release).toBe('function');
    expect(typeof controller.isActive).toBe('boolean');
    expect(typeof controller.method).toBe('string');

    console.log('Keep-awake method:', controller.method);
    console.log('Is active:', controller.isActive);

    await controller.release();
  });

  test('should handle keepAwake with Windows prevention disabled', async () => {
    // Test with Windows-specific prevention disabled
    const controller = await keepAwake({ useSystemPrevent: false });
    expect(controller).toBeDefined();

    console.log('Keep-awake method with prevention disabled:', controller.method);
    console.log('Is active with prevention disabled:', controller.isActive);

    // Should not be active when prevention is disabled
    expect(controller.isActive).toBe(false);
    expect(controller.method).toBe('none');

    await controller.release();
  });

  test('should handle keepAwake with Windows prevention enabled', async () => {
    // Test with Windows-specific prevention explicitly enabled
    const controller = await keepAwake({ useSystemPrevent: true });
    expect(controller).toBeDefined();

    console.log('Keep-awake method with prevention enabled:', controller.method);
    console.log('Is active with prevention enabled:', controller.isActive);

    if (process.platform === 'win32') {
      // On Windows, should use windowsPowerCfg method
      expect(controller.method).toBe('windowsPowerCfg');
      expect(controller.isActive).toBe(true);
    } else {
      // On non-Windows, should be none
      expect(controller.method).toBe('none');
      expect(controller.isActive).toBe(false);
    }

    await controller.release();
  });
});
