import { getNormalizedFormValues } from './getNormalizedFormValues.js';

/**
 * Gets normalized form values from an iframe container.
 *
 * @param {import('puppeteer').Page} page
 * @param {string} iframeSelector
 * @param {string} [containerSelector='#main-container']
 * @returns {Promise<Array<{selector: string, value: string, disabled: boolean, label: string}>>}
 */
export async function getNormalizedFormValuesFromFrame(page, iframeSelector, containerSelector = '#main-container') {
  const iframeElement = await page.$(iframeSelector);
  if (!iframeElement) throw new Error(`Iframe not found: ${iframeSelector}`);

  const frame = await iframeElement.contentFrame();
  if (!frame) throw new Error('Failed to get frame from iframe element');

  return await getNormalizedFormValues(frame, containerSelector);
}
