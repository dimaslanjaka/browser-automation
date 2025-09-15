'use strict';

require('../../chunk-4IBVXDKH.cjs');
var safelinkify = require('safelinkify/browser_module');
var utilsBrowser_js = require('../../utils-browser.js');
var cookie_js = require('./cookie.js');

function _interopNamespace(e) {
  if (e && e.__esModule) return e;
  var n = Object.create(null);
  if (e) {
    Object.keys(e).forEach(function (k) {
      if (k !== 'default') {
        var d = Object.getOwnPropertyDescriptor(e, k);
        Object.defineProperty(n, k, d.get ? d : {
          enumerable: true,
          get: function () { return e[k]; }
        });
      }
    });
  }
  n.default = e;
  return Object.freeze(n);
}

var safelinkify__namespace = /*#__PURE__*/_interopNamespace(safelinkify);

function scrollToTop() {
  if (typeof window !== "undefined" && window.scrollTo) {
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
let sitemapUrls = null;
async function fetchSitemapUrls() {
  if (sitemapUrls) return sitemapUrls;
  try {
    const res = await fetch("/sitemap.txt");
    const text = await res.text();
    sitemapUrls = text.split("\n").map((line) => line.trim()).filter((line) => line && line.startsWith("http"));
    return sitemapUrls;
  } catch (_e) {
    sitemapUrls = [];
    return sitemapUrls;
  }
}
async function getRandomRedirectBase() {
  const urls = await fetchSitemapUrls();
  if (!urls.length) {
    return "https://www.webmanajemen.com/page/safelink.html?url=";
  }
  const base = urls[Math.floor(Math.random() * urls.length)];
  if (base.includes("?url=")) return base;
  if (base.endsWith("/")) return base + "?url=";
  return base + "?url=";
}
async function getSafelinkInstance() {
  const redirect = await getRandomRedirectBase();
  return new safelinkify__namespace.safelink({
    exclude: [/([a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?[.])*webmanajemen\.com/],
    redirect,
    verbose: false,
    type: "base64",
    password: "unique-password"
  });
}
function isValidHttpUrl(str) {
  let url;
  try {
    url = new URL(str);
  } catch (_) {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}
async function decodeSafelinkQueryParameter() {
  const sf = await getSafelinkInstance();
  const parse_safelink = sf.resolveQueryUrl(location.href);
  let urlResult;
  if (parse_safelink) {
    const value_from_query = parse_safelink.url || parse_safelink.o || parse_safelink.u;
    if (value_from_query) {
      const value_cookie = value_from_query.aes.decode || value_from_query.base64.decode;
      if (value_cookie) {
        cookie_js.setCookieMins("safelink_value", value_cookie, 20, location.pathname).then(refreshWithoutParam);
      } else {
        try {
          const parse = new URL(value_from_query.value);
          urlResult = parse.toString();
        } catch {
          console.log("cannot decode", value_from_query.value);
        }
      }
    }
  } else {
    urlResult = cookie_js.getCookie("safelink_value");
    const go = querySelector("#go");
    if (go instanceof Element) {
      go.setAttribute("disabled", "true");
      go.textContent = "Please Wait";
      await utilsBrowser_js.sleep(1e4);
      const a = document.createElement("a");
      if (urlResult.includes("%3A%2F%2F")) {
        urlResult = decodeURIComponent(urlResult);
      }
      a.href = urlResult;
      a.rel = "nofollow noopener noreferer";
      a.target = "_blank";
      a.classList.add("btn", "btn-sm", "btn-success", "text-decoration-none");
      const parse_redirect = parse_url(urlResult);
      a.textContent = "goto " + parse_redirect.host;
      replaceWith(a, go);
    }
  }
  return urlResult;
}
function refreshWithoutParam() {
  location.href = location.pathname;
}
function querySelector(str) {
  const select = document.querySelector(str);
  if (!select) {
    console.error(`document.querySelector("${str}") is null, return {}`);
  }
  return select || {};
}
function replaceWith(newElement, oldElement) {
  if (!oldElement.parentNode) {
    console.log(oldElement, "parent null");
    const d = document.createElement("div");
    d.appendChild(oldElement);
  } else {
    oldElement.parentNode.replaceChild(newElement, oldElement);
  }
}
function parse_url(href) {
  if (!href) {
    href = location.href;
  }
  const l = document.createElement("a");
  l.href = href;
  l["query"] = parse_query({}, href);
  return l;
}
function parse_query(query, search) {
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
  if (typeof query == "function") {
    return urlO;
  }
  if (typeof query === "string" && urlO[query]) {
    return urlO[query];
  }
  return void 0;
}
function islocalhost() {
  if (location.hostname.startsWith("192.168.")) return true;
  if (/(localhost|127.0.0.1|192.168.[0-9]{1,3}\.[0-9]{1,3}):?/gim.test(window.location.host)) return true;
  return false;
}

exports.decodeSafelinkQueryParameter = decodeSafelinkQueryParameter;
exports.getSafelinkInstance = getSafelinkInstance;
exports.isValidHttpUrl = isValidHttpUrl;
exports.islocalhost = islocalhost;
exports.parse_query = parse_query;
exports.parse_url = parse_url;
exports.querySelector = querySelector;
exports.replaceWith = replaceWith;
exports.scrollToTop = scrollToTop;
//# sourceMappingURL=utils.cjs.map
//# sourceMappingURL=utils.cjs.map