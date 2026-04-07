/**
 * Check if an element exists with specific text content and is visible
 *
 * @param {import('puppeteer').Page} page Puppeteer Page object
 * @param {string} selector CSS selector to match elements
 * @param {string} text Text content to match
 * @returns {Promise<boolean>} true if element exists and contains the text
 */
export async function elementWithTextExists(page, selector, text) {
  const elementHandle = await page.$(selector);
  if (!elementHandle) return false;

  const matchesText = await page.evaluate(
    (el, expectedText) => {
      const style = window.getComputedStyle(el);
      const isVisible = style && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
      return isVisible && el.textContent?.includes(expectedText);
    },
    elementHandle,
    text
  );

  return matchesText;
}
