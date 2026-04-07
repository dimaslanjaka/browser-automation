/**
 * Checks if an element matching the selector exists and is visible on the page.
 *
 * @param {import('puppeteer').Page} page - Puppeteer Page instance
 * @param {string} selector - CSS selector for the element to check
 * @returns {Promise<boolean>} Resolves to true if the element exists and is visible, false otherwise
 */
export async function elementExists(page, selector) {
  const elementHandle = await page.$(selector);
  if (!elementHandle) return false;

  const isVisible = await page.evaluate((el) => {
    const style = window.getComputedStyle(el);
    return style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }, elementHandle);

  return isVisible;
}
