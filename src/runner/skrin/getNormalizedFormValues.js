import { getFormValues } from '../../puppeteer_utils.js';

/**
 * Gets normalized form values from page/frame context.
 *
 * @param {import('puppeteer').Page|import('puppeteer').Frame} context
 * @param {string} [containerSelector='#main-container']
 * @returns {Promise<Array<{selector: string, value: string, disabled: boolean, label: string}>>}
 */
export async function getNormalizedFormValues(context, containerSelector = '#main-container') {
  const normalize = (formItems) =>
    formItems
      .map((item) => {
        if (!item.name || item.name.trim().length === 0) {
          return null;
        }
        if (`${item.isVisible || ''}`.toLowerCase() === 'false') {
          return null;
        }

        let valueLabel = item.value || '';
        if (valueLabel.trim().length === 0) {
          valueLabel = '<empty>';
        }

        let keyLabel = '';
        if (item.name && item.name.trim().length > 0) {
          keyLabel = `[name="${item.name}"]`;
        } else if (item.id && item.id.trim().length > 0) {
          keyLabel = `#${item.id}`;
        } else {
          keyLabel = '<empty-key>';
        }

        const isDisabled = `${item.disabled || ''}`.toLowerCase() === 'true';
        return {
          selector: keyLabel,
          value: valueLabel,
          disabled: isDisabled,
          label: item.label || ''
        };
      })
      .filter((item) => item !== null);

  return normalize(await getFormValues(context, containerSelector));
}
