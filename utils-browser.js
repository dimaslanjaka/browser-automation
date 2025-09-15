import './chunk-BUSYA2B4.js';
import Bluebird from 'bluebird';

function noop() {
}
function stripProtocol(url) {
  return url.replace(/^https?:/, "");
}
function loadJS(url, props) {
  props = Object.assign(
    {
      proxy: false,
      onload: noop,
      onerror: noop
    },
    props || {}
  );
  return new Bluebird((resolve, reject) => {
    var _a;
    const script = document.createElement("script");
    if (url.startsWith("//")) {
      url = window.location.protocol + url;
    }
    if (url.startsWith("http") && props.proxy) {
      url = "https://crossorigin.me/" + url;
    }
    const existingSources = Array.from(document.scripts).map((el) => stripProtocol(el.src)).filter((source) => source === stripProtocol(url));
    if (existingSources.length > 0 || document.querySelector(`script[src="${url}"]`)) {
      return resolve((_a = props.onload) == null ? void 0 : _a.call(null));
    }
    script.src = url.replace(/(^\w+:|^)/, window.location.protocol);
    script.async = props.async || false;
    script.defer = props.defer || false;
    script.crossOrigin = props.crossOrigin || "anonymous";
    script.onload = () => {
      var _a2;
      return resolve((_a2 = props.onload) == null ? void 0 : _a2.call(null));
    };
    script.onerror = (err) => {
      var _a2;
      return reject(((_a2 = props.onerror) == null ? void 0 : _a2.call(null)) || err);
    };
    document.body.appendChild(script);
  });
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function getNumbersOnly(str) {
  return `${str}`.replace(/\D+/g, "").trim();
}
function extractNumericWithComma(str) {
  if (typeof str === "number") {
    return String(str).replace(".", ",");
  }
  const match = `${str}`.match(/\d+[.,]?\d*/);
  if (match) {
    return match[0].replace(".", ",");
  }
  return "";
}
function uniqueArrayObjByKey(data, key) {
  return Object.values(
    data.reduce((acc, item) => {
      const id = item[key];
      if (!acc[id]) {
        acc[id] = { ...item };
      } else {
        for (const prop in item) {
          if (prop !== key && item[prop] !== null && item[prop] !== "") {
            acc[id][prop] = item[prop];
          }
        }
      }
      return acc;
    }, {})
  );
}
function getWeekdaysOfCurrentMonth(debug = false) {
  const now = /* @__PURE__ */ new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const result = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dayOfWeek = date.getDay();
    const dayName = date.toLocaleString("en-us", { weekday: "long" });
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yyyy = date.getFullYear();
    const formattedDate = `${dd}/${mm}/${yyyy}`;
    if (debug) {
      console.log(`Date: ${formattedDate}, Day: ${dayName}`);
    }
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      result.push(formattedDate);
    }
  }
  return result;
}
const randomStr = (len = 8) => Math.random().toString(36).substring(2, len + 2);

export { extractNumericWithComma, getNumbersOnly, getWeekdaysOfCurrentMonth, loadJS, noop, randomStr, sleep, stripProtocol, uniqueArrayObjByKey };
//# sourceMappingURL=utils-browser.js.map
//# sourceMappingURL=utils-browser.js.map