/**
 * Navigate a Puppeteer `page` to `url` with retries and exponential backoff.
 * @param {import('puppeteer').Page} page
 * @param {string} url
 * @param {object} [opts]
 * @param {number} [opts.retries=3] - Number of retry attempts (not counting the first try).
 * @param {number} [opts.timeout=30000] - Navigation timeout in ms.
 * @param {string|string[]} [opts.waitUntil='networkidle2'] - Puppeteer waitUntil option.
 * @param {number} [opts.retryDelay=1000] - Initial delay in ms between retries (exponential backoff).
 * @param {function} [opts.onRetry] - Optional callback called before each retry with {attempt, err, delay}.
 * @returns {Promise<import('puppeteer').HTTPResponse|null>}
 */
async function goWithRetry(page, url, opts = {}) {
  const { retries = 3, timeout = 30000, waitUntil = 'networkidle2', retryDelay = 1000, onRetry } = opts;

  let lastErr = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await page.goto(url, { timeout, waitUntil });
      return response;
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
      const delay = Math.round(retryDelay * Math.pow(2, attempt));
      if (typeof onRetry === 'function') {
        try {
          // Support sync and async callbacks. If onRetry returns a Promise,
          // awaiting Promise.resolve will handle both cases.
          await Promise.resolve(onRetry({ attempt, err, delay }));
        } catch (e) {
          // swallow callback errors
        }
      }
      await new Promise((res) => setTimeout(res, delay));
    }
  }

  throw lastErr;
}

export default goWithRetry;
