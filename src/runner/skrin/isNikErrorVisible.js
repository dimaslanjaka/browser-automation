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

      if (!isVisible) continue;

      // Check if the notification content contains NIK error message (case-insensitive)
      const text = (el.innerText || el.textContent || '').toLowerCase();
      if (text.includes('nik harus 16 digit') || text.includes('nik error') || text.includes('nik tidak valid')) {
        return true;
      }
    }
    return false;
  });
}
