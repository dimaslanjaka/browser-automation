/**
 * Checks if the session-expired notification alert is visible on the page.
 *
 * @param {import('puppeteer').Page} page - The Puppeteer Page instance.
 * @returns {Promise<boolean>} - Resolves to `true` if the session-expired alert is visible, otherwise `false`.
 */
export async function isSessionExpiredAlertVisible(page) {
  return await page.evaluate(() => {
    const alerts = document.querySelectorAll('.k-widget.k-notification.k-notification-error[data-role="alert"]');
    for (const alert of alerts) {
      const text = alert.textContent || '';
      const isSessionExpiredText = /session\s+anda\s+telah\s+habis/i.test(text) && /login\s+kembali/i.test(text);
      if (!isSessionExpiredText) {
        continue;
      }

      const style = window.getComputedStyle(alert);
      const rect = alert.getBoundingClientRect();
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
