import { typeAndTrigger } from './puppeteer_utils.js';

/**
 * Checks if an invalid alert is visible on the page.
 * @param {import('puppeteer').Page} page - The Puppeteer page instance.
 * @returns {Promise<boolean>} - True if the alert is visible, otherwise false.
 */
export async function isInvalidAlertVisible(page) {
  return await page.evaluate(() => {
    const elem = document.querySelector('.k-widget.k-tooltip.k-tooltip-validation.k-invalid-msg');
    if (!elem) return false;

    const style = window.getComputedStyle(elem);
    return (
      style &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      elem.offsetWidth > 0 &&
      elem.offsetHeight > 0
    );
  });
}

/**
 * Checks if the ID modal (maximized window) is visible on the page.
 *
 * @param {import('puppeteer').Page} page - The Puppeteer page instance.
 * @returns {Promise<boolean>} - Resolves to `true` if the modal is visible, otherwise `false`.
 */
export async function isIdentityModalVisible(page) {
  return (
    (await page.evaluate(() => {
      const modal = document.querySelector('.k-widget.k-window.k-window-maximized');
      return (
        modal && window.getComputedStyle(modal).display !== 'none' && modal.offsetWidth > 0 && modal.offsetHeight > 0
      );
    })) || false
  );
}

export async function confirmIdentityModal(page) {
  // Get the correct iframe inside #dialog
  const iframeElement = await page.$('#dialog iframe.k-content-frame');
  if (!iframeElement) {
    console.log('❌ Iframe inside #dialog not found!');
  } else {
    // Get iframe content
    const iframe = await iframeElement.contentFrame();
    if (!iframe) {
      console.log('❌ Failed to get content of iframe inside #dialog!');
    } else {
      // Wait for the button inside the iframe
      try {
        await iframe.waitForSelector('#pilih', { timeout: 5000 });
      } catch (_e) {
        console.log('❌ Failed to wait for the button inside the iframe (#pilih).');
      }

      // Click the button inside the iframe
      if (await page.$('#pilih')) {
        await iframe.click('#pilih');
        console.log('✅ Clicked the button inside the iframe (#pilih) successfully.');
      }
    }
  }
}

/**
 * Checks if a visible error notification with the class `.k-notification-error`
 * is present on the page. Specifically used to detect the NIK error message.
 *
 * @param {import('puppeteer').Page} page - The Puppeteer Page instance.
 * @returns {Promise<boolean>} - Resolves to `true` if a visible error notification is found, otherwise `false`.
 */
export async function isNikErrorVisible(page) {
  return await page.evaluate(() => {
    const elements = document.querySelectorAll('.k-notification-error');
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const isVisible =
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        parseFloat(style.opacity) > 0 &&
        rect.width > 0 &&
        rect.height > 0;

      if (isVisible) return true;
    }
    return false;
  });
}

/**
 * Checks if a visible success notification with the class `.k-notification-success`
 * is present on the page.
 *
 * @param {import('puppeteer').Page} page - The Puppeteer Page instance.
 * @returns {Promise<boolean>} - Resolves to `true` if a visible success notification is found, otherwise `false`.
 */
export async function isSuccessNotificationVisible(page) {
  return await page.evaluate(() => {
    const elements = document.querySelectorAll('.k-notification-success');
    for (const el of elements) {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      const isVisible =
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        parseFloat(style.opacity) > 0 &&
        rect.width > 0 &&
        rect.height > 0;

      if (isVisible) return true;
    }
    return false;
  });
}

/**
 * Checks if the error modal is visible on the page.
 * @param {import('puppeteer').Page} page - The Puppeteer page instance.
 * @returns {Promise<boolean>} - Resolves to true if the error modal is visible, otherwise false.
 */
export async function isNIKNotFoundModalVisible(page) {
  return await page.evaluate(() => {
    const modal = document.querySelector('[aria-labelledby="dialogconfirm_wnd_title"]');
    return modal && modal.innerText.includes('Data tidak ditemukan');
  });
}

/**
 * Generate a random number within a given range.
 * @param {number} min - The minimum value.
 * @param {number} max - The maximum value.
 * @returns {number} A random number between min and max.
 */
export function getRandomInRange(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Get height range based on age and gender for Indonesian population.
 * @param {number} age - The age of the person.
 * @param {string} gender - The gender ('laki-laki' or 'perempuan').
 * @returns {number} A random height value.
 */
export function getTinggiBadan(age, gender) {
  const tinggiRange = {
    'laki-laki': {
      0: [45, 55],
      1: [65, 75],
      2: [75, 85],
      3: [85, 95],
      4: [90, 100],
      5: [100, 108],
      10: [125, 135],
      15: [150, 170],
      20: [168, 190],
      30: [170, 190],
      40: [168, 188],
      50: [165, 185],
      60: [160, 180],
      70: [155, 175],
      80: [150, 170],
      90: [145, 165],
      100: [140, 160]
    },
    perempuan: {
      0: [45, 54],
      1: [64, 74],
      2: [74, 84],
      3: [84, 94],
      4: [89, 99],
      5: [98, 106],
      10: [123, 133],
      15: [148, 165],
      20: [162, 180],
      30: [165, 178],
      40: [162, 175],
      50: [160, 170],
      60: [157, 168],
      70: [154, 165],
      80: [150, 160],
      90: [145, 155],
      100: [140, 150]
    }
  };

  const data = tinggiRange[gender.toLowerCase()];
  if (!data) return null;

  const ages = Object.keys(data).map(Number);
  const closestAge = ages.reduce((prev, curr) => (Math.abs(curr - age) < Math.abs(prev - age) ? curr : prev));
  const [min, max] = data[closestAge];
  return getRandomInRange(min, max);
}

/**
 * Get weight range based on age and gender for Indonesian population.
 * @param {number} age - The age of the person.
 * @param {string} gender - The gender ('laki-laki' or 'perempuan').
 * @returns {number} A random weight value.
 */
export function getBeratBadan(age, gender) {
  const beratRange = {
    'laki-laki': {
      0: [2, 5],
      1: [7, 10],
      2: [9, 14],
      3: [12, 16],
      4: [13, 18],
      5: [14, 18],
      10: [25, 35],
      15: [42, 65],
      20: [60, 90],
      30: [65, 95],
      40: [70, 100],
      50: [68, 95],
      60: [65, 90],
      70: [60, 85],
      80: [55, 80],
      90: [50, 75],
      100: [45, 70]
    },
    perempuan: {
      0: [2, 4.5],
      1: [6, 9],
      2: [8, 12],
      3: [10, 15],
      4: [12, 17],
      5: [13, 17],
      10: [24, 34],
      15: [38, 55],
      20: [55, 80],
      30: [60, 85],
      40: [62, 88],
      50: [60, 85],
      60: [58, 82],
      70: [55, 80],
      80: [50, 75],
      90: [45, 70],
      100: [40, 65]
    }
  };

  const data = beratRange[gender.toLowerCase()];
  if (!data) return null;

  const ages = Object.keys(data).map(Number);
  const closestAge = ages.reduce((prev, curr) => (Math.abs(curr - age) < Math.abs(prev - age) ? curr : prev));
  const [min, max] = data[closestAge];
  return getRandomInRange(min, max);
}

/**
 * Fix the height and weight input fields if they are empty.
 * @param {import('puppeteer').Page} page - The Puppeteer page instance.
 * @param {number|string} age - The age of the person.
 * @param {string} gender - The gender of the person ('laki-laki' or 'perempuan').
 */
export async function fixTbAndBb(page, age, gender) {
  const tbValue = await page.$eval('#field_item_tinggi_badan input', (input) => input.value.trim());
  if (!tbValue) {
    const tinggiBadan = getTinggiBadan(age, gender);
    if (tinggiBadan) {
      await typeAndTrigger(page, '#field_item_tinggi_badan input', tinggiBadan.toString());
    } else {
      throw new Error('Tinggi badan tidak valid');
    }
  }

  const bbValue = await page.$eval('#field_item_berat_badan input', (input) => input.value.trim());
  if (!bbValue) {
    const beratBadan = getBeratBadan(age, gender);
    if (beratBadan) {
      await typeAndTrigger(page, '#field_item_berat_badan input', beratBadan.toString());
    } else {
      throw new Error('Berat badan tidak valid');
    }
  }
}
