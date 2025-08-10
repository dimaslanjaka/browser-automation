import * as safelinkify from 'safelinkify/dist/safelink-browser-module';
import { sleep } from '../../utils-browser.js';
import { getCookie, setCookieMins } from './cookie.js';

/**
 * Scrolls the window to the top of the page with a sequence of scrolls for smoother effect.
 * Uses setTimeout to scroll to top, then to the middle, then back to top, each after 800ms.
 * Does nothing if not running in a browser environment.
 */
export function scrollToTop() {
  if (typeof window !== 'undefined' && window.scrollTo) {
    // window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => {
      window.scrollTo(0, 0);
      setTimeout(() => {
        window.scrollTo(0, document.body.scrollHeight / 2);
        setTimeout(() => {
          window.scrollTo(0, 0);
        }, 800);
      }, 800);
    }, 800);
  }
}

/**
 * Store the loaded sitemap URLs in memory for caching.
 * @type {string[]|null}
 */
let sitemapUrls = null;

/**
 * Fetch and cache sitemap URLs from /sitemap.txt.
 * @returns {Promise<string[]>} Array of sitemap URLs.
 */
async function fetchSitemapUrls() {
  if (sitemapUrls) return sitemapUrls;
  try {
    const res = await fetch('/sitemap.txt');
    const text = await res.text();
    sitemapUrls = text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && line.startsWith('http'));
    return sitemapUrls;
  } catch (_e) {
    sitemapUrls = [];
    return sitemapUrls;
  }
}

/**
 * Get a random redirect base URL from the sitemap, or fallback to a default.
 * @returns {Promise<string>} The redirect base URL.
 */
async function getRandomRedirectBase() {
  const urls = await fetchSitemapUrls();
  if (!urls.length) {
    // fallback to default
    return 'https://www.webmanajemen.com/page/safelink.html?url=';
  }
  // Pick a random URL and append the safelink path if needed
  const base = urls[Math.floor(Math.random() * urls.length)];
  // Ensure it ends with / or ?url=
  if (base.includes('?url=')) return base;
  if (base.endsWith('/')) return base + '?url=';
  return base + '?url=';
}

/**
 * Factory to get a safelink instance with a random redirect base.
 * @returns {Promise<safelinkify.safelink>} A safelink instance.
 */
export async function getSafelinkInstance() {
  const redirect = await getRandomRedirectBase();
  return new safelinkify.safelink({
    exclude: [/([a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?[.])*webmanajemen\.com/],
    redirect,
    verbose: false,
    type: 'base64',
    password: 'unique-password'
  });
}

/**
 * Validate if a string is a valid HTTP or HTTPS URL.
 * @param {string} str - The string to validate.
 * @returns {boolean} True if valid HTTP/HTTPS URL, false otherwise.
 */
export function isValidHttpUrl(str) {
  let url;
  try {
    url = new URL(str);
  } catch (_) {
    return false;
  }
  return url.protocol === 'http:' || url.protocol === 'https:';
}

/**
 * Start decoding safelink from the current URL or cookie and handle redirection or value extraction.
 * Calls setCookieMins and refreshes the page if decoded, or replaces the go button if not.
 */
export async function decodeSafelinkQueryParameter() {
  const sf = await getSafelinkInstance();
  const parse_safelink = sf.resolveQueryUrl(location.href);
  let urlResult;
  if (parse_safelink) {
    const value_from_query = parse_safelink.url || parse_safelink.o || parse_safelink.u;
    if (value_from_query) {
      const value_cookie = value_from_query.aes.decode || value_from_query.base64.decode;
      // set cookie value and refresh without parameters
      if (value_cookie) {
        setCookieMins('safelink_value', value_cookie, 20, location.pathname).then(refreshWithoutParam);
      } else {
        try {
          // check if query is url
          const parse = new URL(value_from_query.value);
          urlResult = parse.toString();
          // redirect to url
          // location.href = parse.toString();
        } catch {
          // the query is not valid url
          console.log('cannot decode', value_from_query.value);
        }
      }
    }
  } else {
    // get safelink value from cookie
    urlResult = getCookie('safelink_value');
    // Replace the go button with the decoded value
    const go = querySelector('#go');
    if (go instanceof Element) {
      go.setAttribute('disabled', 'true');
      go.textContent = 'Please Wait';
      // wait 10 seconds
      await sleep(10000);
      const a = document.createElement('a');
      // detect encoded protocol
      if (urlResult.includes('%3A%2F%2F')) {
        urlResult = decodeURIComponent(urlResult);
      }
      a.href = urlResult;
      a.rel = 'nofollow noopener noreferer';
      a.target = '_blank';
      a.classList.add('btn', 'btn-sm', 'btn-success', 'text-decoration-none');
      const parse_redirect = parse_url(urlResult);
      a.textContent = 'goto ' + parse_redirect.host;
      replaceWith(a, go);
    }
  }
  return urlResult;
}

/**
 * Refresh the page without any URL parameters.
 */
function refreshWithoutParam() {
  location.href = location.pathname;
}

/**
 * Safe query selector that returns the element or an empty object if not found.
 * @param {string} str - The selector string.
 * @returns {Element|Object} The selected element or an empty object.
 */
export function querySelector(str) {
  const select = document.querySelector(str);
  if (!select) {
    console.error(`document.querySelector("${str}") is null, return {}`);
  }
  return select || {};
}

/**
 * Replace an old DOM element with a new one.
 * @param {Element} newElement - The new element to insert.
 * @param {Element} oldElement - The old element to be replaced.
 */
export function replaceWith(newElement, oldElement) {
  if (!oldElement.parentNode) {
    console.log(oldElement, 'parent null');
    const d = document.createElement('div');
    d.appendChild(oldElement);
  } else {
    //log(oldElement.parentNode.tagName);
    oldElement.parentNode.replaceChild(newElement, oldElement);
  }
}

/**
 * Parse a URL string to an HTMLAnchorElement and attach a query object.
 * @param {string} [href] - The URL to parse. Defaults to current location.
 * @returns {HTMLAnchorElement & {query: Object}} Anchor element with query property.
 */
export function parse_url(href) {
  if (!href) {
    href = location.href;
  }
  const l = document.createElement('a');
  l.href = href;
  l['query'] = parse_query({}, href);
  return l;
}

/**
 * Parse query parameters from a URL or the current location, including hash.
 * @param {string|function} query - The query key to extract or a function to return all params.
 * @param {string} [search] - The search string or full URL. Defaults to current location.
 * @returns {Object|undefined} The query object, value, or undefined.
 */
export function parse_query(query, search) {
  if (!search) {
    search = window.location.search;
  } else if (/^https?:\/\//i.test(search)) {
    search = new URL(search).search;
  }
  let urlParams = new URLSearchParams(search);
  const urlp = Object.fromEntries(urlParams);
  const hash = window.location.hash.substring(1);
  urlParams = new URLSearchParams(hash);
  const urlh = Object.fromEntries(urlParams);
  const urlO = Object.assign(urlh, urlp);
  if (typeof query == 'function') {
    return urlO;
  }
  if (typeof query === 'string' && urlO[query]) {
    return urlO[query];
  }
  return undefined;
}

/**
 * Check if the current script is running on localhost or a local network.
 * Matches localhost, 127.0.0.1, or 192.168.* addresses.
 * @returns {boolean} True if running locally, false otherwise.
 */
export function islocalhost() {
  // local hostname
  //if (['adsense.webmanajemen.com', 'localhost', '127.0.0.1'].includes(location.hostname)) return true;
  // local network
  if (location.hostname.startsWith('192.168.')) return true;
  // port defined
  //if (location.port.length > 0) return true;
  // pattern regex
  if (/(localhost|127.0.0.1|192.168.[0-9]{1,3}\.[0-9]{1,3}):?/gim.test(window.location.host)) return true;
  return false;
}
