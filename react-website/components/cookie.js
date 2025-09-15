import '../../chunk-BUSYA2B4.js';

function setCookie(name, value, expires, path, domain, secure) {
  let exp = "";
  if (expires) {
    const d = /* @__PURE__ */ new Date();
    d.setTime(d.getTime() + parseInt(`${expires}`) * 24 * 60 * 60 * 1e3);
    exp = "; expires=" + d.toUTCString();
  }
  if (!path) {
    path = "/";
  }
  const cookie = name + "=" + encodeURIComponent(value) + exp + "; path=" + path + (domain ? "; domain=" + domain : "") + (secure ? "; secure" : "");
  document.cookie = cookie;
}
function setCookieMins(name, value, minutes = 10, path = "/", domain, secure) {
  return new Promise(function(resolve) {
    let expires;
    if (minutes) {
      const date = /* @__PURE__ */ new Date();
      date.setTime(date.getTime() + minutes * 60 * 1e3);
      expires = "; expires=" + date.toUTCString();
    } else {
      expires = "";
    }
    const cookie = name + "=" + encodeURIComponent(value) + expires + "; path=" + path + (domain ? "; domain=" + domain : "") + (secure ? "; secure" : "");
    document.cookie = cookie;
    resolve(null);
  });
}
function getCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) == " ") c = c.substring(1);
    if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length);
  }
  return null;
}
function getCookies(options = { sort: false }) {
  const { sort = false, skipKey = [] } = options;
  const pairs = document.cookie.split(";");
  const cookies = {};
  for (let i = 0; i < pairs.length; i++) {
    const pair = pairs[i].split("=");
    cookies[(pair[0] + "").trim()] = unescape(pair.slice(1).join("="));
  }
  if (skipKey.length > 0) {
    for (const key in cookies) {
      if (skipKey.includes(key)) delete cookies[key];
    }
  }
  if (sort) {
    const sorted = {};
    const sortKeys = Object.keys(cookies).sort((a, b) => a === b ? 0 : a < b ? -1 : 1);
    sortKeys.forEach((key) => {
      sorted[key] = cookies[key];
    });
    return sorted;
  }
  return cookies;
}
function eraseCookie(name) {
  document.cookie = name + "=; Max-Age=-99999999;";
}
function removeCookie(name) {
  return eraseCookie(name);
}
function deleteAllCookies() {
  const cookies = document.cookie.split(";");
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i];
    const eqPos = cookie.indexOf("=");
    const name = eqPos > -1 ? cookie.substring(0, eqPos) : cookie;
    document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }
}
function getCurrentPageId() {
  if (!getCookie("___current_id")) {
    setCookie("___current_id", Math.random().toString(36).substring(2, 9), 1);
  }
  if (!window.pageId) window.pageId = getCookie("___current_id");
  return window.pageId;
}

export { deleteAllCookies, eraseCookie, getCookie, getCookies, getCurrentPageId, removeCookie, setCookie, setCookieMins };
//# sourceMappingURL=cookie.js.map
//# sourceMappingURL=cookie.js.map