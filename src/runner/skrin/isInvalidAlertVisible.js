/**
 * Checks if an invalid alert is visible on the page.
 * @param {import('puppeteer').Page} page - The Puppeteer page instance.
 * @returns {Promise<{ result: boolean, contents: string[] }>} - Whether any alert is visible and the visible alert texts.
 */
export async function isInvalidAlertVisible(page) {
  return await page.evaluate(() => {
    const elements = document.querySelectorAll('.k-invalid-msg[role="alert"]');
    const contents = [];

    for (const elem of elements) {
      const style = window.getComputedStyle(elem);
      const rect = elem.getBoundingClientRect();
      const isVisible =
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        parseFloat(style.opacity || '1') > 0 &&
        rect.width > 0 &&
        rect.height > 0;

      if (isVisible) {
        const content = (elem.textContent || '').trim();
        if (content) contents.push(content);
      }
    }

    return { result: contents.length > 0, contents };
  });
}
