import { findIframeElementByText, getPuppeteer, isIframeTextVisible } from '../puppeteer_utils.js';
import { skrinLogin, enterSkriningPage } from '../skrin_puppeteer.js';
import { loadCsvData } from '../../data/index.js';
import * as nikUtils from 'nik-parser-jurusid/index';
import { getNumbersOnly, logLine, sleep } from '../utils.js';
import { array_random } from 'sbg-utility';

export async function _test() {
  const { page } = await getPuppeteer();
  await skrinLogin(page);
  await enterSkriningPage(page, false);

  await sleep(3000);

  const iframeSelector = '.k-window-content iframe.k-content-frame';
  const iframeElement = await page.$(iframeSelector);
  const iframe = await iframeElement.contentFrame();
  const iframeType = async (selector, value) => {
    // Skip if element is hidden
    const isVisible = await iframe.$eval(selector, (el) => {
      const style = window.getComputedStyle(el);
      return style && style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
    });
    if (!isVisible) {
      logLine(`Element ${selector} is not visible, skipping typing.`);
      return;
    }
    // Scroll to the element before typing
    await iframe.$eval(selector, (el) => el.scrollIntoView({ behavior: 'auto', block: 'center' }));
    // Focus the element before typing
    await iframe.focus(selector);
    // Reset existing value before typing
    await page.evaluate(
      (iframeSelector, selector) => {
        const iframe = document.querySelector(iframeSelector);
        const element = iframe.contentDocument.querySelector(selector);
        element.value = '';
        element.dispatchEvent(new iframe.contentWindow.Event('input', { bubbles: true }));
      },
      iframeSelector,
      selector
    );
    // Type the value into the input field
    await iframe.type(selector, value, { delay: 100 });
    // Trigger input and change events
    await iframe.$eval(selector, (el) => {
      const event = new Event('change', { bubbles: true });
      el.dispatchEvent(event);
    });
    // Wait for the input to stabilize
    await sleep(1000);
  };
  await iframeType('#field_item_metode_id input[type="text"]', 'Tunggal');
  await iframeType('input[name="tempat_skrining_id_input"]', 'Puskesmas');

  const dataKunto = await loadCsvData();
  const singleData = array_random(dataKunto, function (item) {
    return nikUtils.isValidNIK(item.nik);
  });
  await iframeType('input[name="nik"]', getNumbersOnly(singleData.nik));

  await sleep(10000); // Wait for the NIK input to process

  // Narrow the search to Kendo modal container:
  const parentSelector = 'div.k-window[data-role="draggable"]';

  const modal = await findIframeElementByText(page, iframeSelector, parentSelector, 'Data tidak ditemukan');

  if (modal) {
    console.log('✅ Found confirmation modal');
    const yesButton = await modal.$('#yesButton');
    if (yesButton) await yesButton.click();
    await sleep(500);
  } else {
    console.log('❌ No matching modal found');
  }

  const found = await isIframeTextVisible(page, iframeSelector, parentSelector, 'Data tidak ditemukan');

  if (found) {
    console.log('✅ Visible modal with "Data tidak ditemukan" found in iframe');
  } else {
    console.log('❌ Modal text not visible or not found');
  }

  await iframeType('#field_item_nama_peserta input[type="text"]', singleData.nama);

  // await page.browser().close();
}

_test();
