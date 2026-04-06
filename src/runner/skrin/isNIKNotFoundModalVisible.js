/**
 * Checks if the error modal is visible on the page.
 * @param {import('puppeteer').Page} page - The Puppeteer page instance.
 * @returns {Promise<boolean>} - Resolves to true if the error modal is visible, otherwise false.
 */
export async function isNIKNotFoundModalVisible(page) {
  return await page.evaluate(() => {
    const modal = document.querySelector('[aria-labelledby="dialogconfirm_wnd_title"]');
    if (modal && modal.innerText.includes('Data tidak ditemukan')) {
      // Check visibility: display, visibility, opacity, and boundingClientRect
      const style = window.getComputedStyle(modal);
      const rect = modal.getBoundingClientRect();
      return (
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0' &&
        rect.width > 0 &&
        rect.height > 0
      );
    }
    return false;
  });
}
