/**
 * Checks if an invalid alert is visible on the page.
 * @param {import('puppeteer').Page} page - The Puppeteer page instance.
 * @returns {Promise<boolean>} - True if the alert is visible, otherwise false.
 */
export async function isInvalidAlertVisible(page) {
  return await page.evaluate(() => {
    const elements = document.querySelectorAll('.k-invalid-msg[role="alert"]');

    for (const elem of elements) {
      const style = window.getComputedStyle(elem);
      const rect = elem.getBoundingClientRect();
      const isVisible =
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        parseFloat(style.opacity || '1') > 0 &&
        rect.width > 0 &&
        rect.height > 0;

      if (isVisible) return true;
    }

    return false;
  });
}
