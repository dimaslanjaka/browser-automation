/**
 * Extracts attribute values and common properties from input and textarea elements.
 *
 * NOTE: This function is executed inside the browser context (for example via `$$eval`).
 * It returns plain JSON-serializable objects and must not rely on external variables or
 * runtime helpers.
 *
 * @param {HTMLInputElement[]|HTMLTextAreaElement[]} elements - Array of input or textarea elements from the DOM.
 * @returns {Array<Object>} Array of plain objects with attributes and common properties.
 */
export function extractFormValues(elements) {
  return elements.map((el) => {
    const attrs = Array.from(el.attributes).reduce((acc, attr) => {
      acc[attr.name] = String(attr.value);
      return acc;
    }, {});

    const isVisible = !!(el.offsetParent || el.offsetWidth > 0 || el.offsetHeight > 0);
    let textLabel = '';
    let currentEl = el; // Start from the target element

    for (let i = 0; i < 6 && currentEl; i++) {
      const labelEl = currentEl.querySelector('.form-item-label');
      if (labelEl) {
        textLabel = labelEl.textContent.trim();
        break;
      }
      currentEl = currentEl.parentElement; // Move one level up
    }

    const result = {};
    for (const k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) result[k] = attrs[k];
    }
    result.name = el.name || '';
    result.value = el.value;
    result.id = el.id || '';
    result.disabled = String(el.disabled);
    result.isVisible = String(isVisible);
    result.label = textLabel;
    return result;
  });
}

/**
 * Get values of all input and textarea elements within a container inside an iframe.
 *
 * @param {import('puppeteer').Page} page - The Puppeteer page instance.
 * @param {string} iframeSelector - The CSS selector for the iframe.
 * @param {string} containerSelector - The CSS selector for the container inside the iframe.
 * @returns {Promise<Array<Object>>}
 */
export async function getFormValuesFromFrame(page, iframeSelector, containerSelector) {
  const iframeElement = await page.$(iframeSelector);
  if (!iframeElement) throw new Error(`Iframe not found: ${iframeSelector}`);

  const frame = await iframeElement.contentFrame();
  if (!frame) throw new Error(`Failed to get frame from iframe element`);

  return await frame.$$eval(`${containerSelector} input, ${containerSelector} textarea`, extractFormValues);
}
