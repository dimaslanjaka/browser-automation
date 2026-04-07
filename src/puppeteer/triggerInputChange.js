/**
 * Triggers 'input' and 'change' events on an input or textarea element,
 * optionally within an iframe. Does NOT change the element’s value.
 *
 * @param {import('puppeteer').Page} page - Puppeteer Page object
 * @param {string} selector - CSS selector for the input or textarea
 * @param {Object} [options]
 * @param {string} [options.frameSelector] - Optional iframe CSS selector
 * @param {string} [options.frameName] - Optional iframe name
 */
export async function triggerInputChange(page, selector, options = {}) {
  const { frameSelector, frameName } = options;

  let frame = page.mainFrame();

  if (frameSelector) {
    const iframeHandle = await page.$(frameSelector);
    if (!iframeHandle) throw new Error(`Iframe not found with selector: ${frameSelector}`);
    frame = await iframeHandle.contentFrame();
  } else if (frameName) {
    frame = page.frames().find((f) => f.name() === frameName);
    if (!frame) throw new Error(`Iframe not found with name: ${frameName}`);
  }

  if (!frame) throw new Error('Target frame could not be resolved.');

  await frame.evaluate((selector) => {
    const el = document.querySelector(selector);
    if (!el) throw new Error(`Element not found: ${selector}`);

    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, selector);
}
