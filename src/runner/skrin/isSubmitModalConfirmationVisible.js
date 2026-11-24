/**
 * Checks if the save confirmation modal is visible.
 * The modal appears after clicking the save button and asks:
 * "Apakah Anda yakin telah mengisi data dengan benar?"
 * It has a title "#dialogconfirm_wnd_title" with "Validasi NIK dan Tanggal Skrining"
 * and buttons "#yesButton" (Ya) and "#noButton" (Tidak).
 *
 * @param {import('puppeteer').Page} page - The Puppeteer Page instance.
 * @returns {Promise<boolean>} - Resolves to `true` if the confirmation modal is visible, otherwise `false`.
 */
export async function isSubmitModalConfirmationVisible(page) {
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
      if (/Apakah Anda yakin telah mengisi data dengan benar/i.test(text)) return true;
    }
    return false;
  });
}