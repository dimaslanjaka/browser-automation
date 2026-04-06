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
