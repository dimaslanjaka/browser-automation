/**
 * Checks if the save confirmation modal is visible.
 * This modal appears after clicking the save button when NIK was already registered on a different date.
 * The modal has:
 * - Title "#dialogconfirm_wnd_title" with text "Konfirmasi"
 * - Content "Validasi NIK dan Tanggal Skrining" with NIK details
 * - Buttons "#yesButton" (Ya) and "#noButton" (Tidak)
 *
 * @param {import('puppeteer').Page} page - The Puppeteer Page instance.
 * @returns {Promise<boolean>} - Resolves to `true` if the save confirmation modal is visible, otherwise `false`.
 */
export async function isSaveConfirmationModalVisible(page) {
  return await page.evaluate(() => {
    const modal = document.querySelector('#dialogconfirm');
    if (!modal) return false;

    const title = document.querySelector('#dialogconfirm_wnd_title');
    if (!title) return false;

    const style = window.getComputedStyle(modal);
    const rect = modal.getBoundingClientRect();

    const isVisible =
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      parseFloat(style.opacity) > 0 &&
      rect.width > 0 &&
      rect.height > 0;

    if (isVisible) {
      const text = modal.innerText || modal.textContent || '';
      if (/Validasi NIK dan Tanggal Skrining/i.test(text)) return true;
    }
    return false;
  });
}