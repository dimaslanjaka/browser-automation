/**
 * Attempts to click the "Iya" (or #pilih) button inside an iframe within a modal dialog.
 * Adds secondary validation and JS-based fallback for clicking.
 *
 * @async
 * @function
 * @param {import('puppeteer').Page|import('puppeteer').Frame} page - The Puppeteer Page instance representing the browser tab.
 * @returns {Promise<void>} Resolves when the click is attempted or logs an appropriate error.
 */
export async function confirmIdentityModal(page) {
  const iframeElement = await page.$('#dialog iframe.k-content-frame');
  if (!iframeElement) {
    console.log('❌ Iframe inside #dialog not found!');
    return;
  }

  const iframe = await iframeElement.contentFrame();
  if (!iframe) {
    console.log('❌ Failed to get content of iframe inside #dialog!');
    return;
  }

  try {
    await iframe.waitForSelector('body', { visible: true, timeout: 10000 });

    const pilihBtn = await iframe.$('#pilih');
    if (pilihBtn) {
      const box = await pilihBtn.boundingBox();
      if (box) {
        try {
          await Promise.all([
            page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => null),
            pilihBtn.click({ delay: 100 })
          ]);

          await new Promise((resolve) => setTimeout(resolve, 500));

          const modalStillVisible = await page.$eval('#dialog', (el) => el.offsetParent !== null).catch(() => false);
          if (!modalStillVisible) {
            console.log('✅ #pilih clicked, modal gone.');
            return;
          }

          console.warn('⚠️ Modal still visible. Trying JS-based dispatch as fallback...');
          const jsDispatchWorked = await iframe.evaluate(() => {
            const btn = document.querySelector('#pilih');
            if (!btn) return false;

            btn.dispatchEvent(
              new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
              })
            );
            return true;
          });

          await new Promise((resolve) => setTimeout(resolve, 500));

          const stillVisible = await page.$eval('#dialog', (el) => el.offsetParent !== null).catch(() => false);
          if (!stillVisible && jsDispatchWorked) {
            console.log('✅ JS-dispatch click closed modal.');
            return;
          }

          console.log('❌ JS dispatch didn’t close modal.');
        } catch (err) {
          console.error('❌ Error while clicking #pilih:', err);
          return;
        }
      } else {
        console.warn('⚠️ #pilih is not visible (no bounding box).');
      }
    }

    const iyaClicked = await iframe.evaluate(() => {
      try {
        const xpath = "//button[contains(translate(., 'IYA', 'iya'), 'iya')]";
        const result = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null);
        const btn = result.singleNodeValue;
        if (btn instanceof HTMLElement) {
          btn.dispatchEvent(
            new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window
            })
          );
          return true;
        }
        return false;
      } catch {
        return false;
      }
    });

    if (iyaClicked) {
      console.log('✅ Clicked "Iya" button using XPath + JS dispatch.');
    } else {
      console.log('❌ No #pilih or "Iya" button found or clickable.');
    }
  } catch (err) {
    console.error('❌ Error in confirmIdentityModal:', err);
  }
}
