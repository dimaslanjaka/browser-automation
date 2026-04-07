/**
 * Check if any element matching the selector contains the given text
 *
 * @param {import('puppeteer').Page} page - Puppeteer page instance
 * @param {string} selector - CSS selector (e.g., "form")
 * @param {string} text - Substring to check inside elements
 * @returns {Promise<boolean>}
 */
export async function elementsContainText(page, selector, text) {
  return await page.evaluate(
    (sel, str) => {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (el.innerText.includes(str)) {
          return true;
        }
      }
      return false;
    },
    selector,
    text
  );
}
