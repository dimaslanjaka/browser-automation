/**
 * Return the currently active/focused Page in a Browser, if detectable.
 *
 * This attempts to evaluate `document.hasFocus()` in each open page and
 * returns the first page that reports focus. If none report focus, it
 * falls back to the last opened page or null if no pages exist.
 *
 * @param {import('puppeteer').Browser} browser
 * @returns {Promise<import('puppeteer').Page|null>}
 */
export async function getActivePage(browser) {
  if (!browser || typeof browser.pages !== 'function') return null;

  let pages;
  try {
    pages = await browser.pages();
  } catch (_e) {
    return null;
  }

  for (const p of pages) {
    try {
      const hasFocus = await p.evaluate(() => {
        try {
          return document.hasFocus();
        } catch (_e) {
          return false;
        }
      });
      if (hasFocus) return p;
    } catch (_e) {
      // ignore pages that cannot be evaluated
    }
  }

  // Fallback: return the most recently opened page if any
  return pages.length ? pages[pages.length - 1] : null;
}
