'use strict';

require('../../chunk-4IBVXDKH.cjs');
var moment = require('moment-timezone');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var moment__default = /*#__PURE__*/_interopDefault(moment);

function momentTimezonePlayground() {
  if (typeof location !== "undefined" && location.host.includes("cdpn")) console.clear();
}
function moment_format(dateInput, custom_pattern, custom_timezone) {
  let date;
  if (isNumeric(dateInput)) {
    date = moment__default.default(dateInput).toDate();
  }
  if (typeof dateInput === "string") {
    date = new Date(dateInput);
  }
  let value = "";
  if (typeof custom_pattern === "string" && custom_pattern.length > 0) {
    value = custom_pattern;
  } else if (custom_pattern && custom_pattern.value && custom_pattern.value.length > 0) {
    value = custom_pattern.value;
  }
  let timezone = void 0;
  if (typeof document !== "undefined") {
    const date_timezone = document.getElementById("date-timezone");
    if (date_timezone && date_timezone.value) {
      timezone = date_timezone.value.trim();
    }
  }
  if (typeof custom_timezone === "string" && custom_timezone.length > 0) {
    timezone = custom_timezone;
  }
  return moment__default.default(date).tz(timezone).format(value);
}
function setDateLocalValue(element, date) {
  const value = moment_format(date, "YYYY-MM-DD HH:mm:ss");
  console.log("set value", { value });
  element.value = value;
}
function isNumeric(str) {
  return !isNaN(str) && !isNaN(parseFloat(str));
}
function getTimeZoneOffset() {
  const result = {
    timeZone: void 0,
    offset: void 0
  };
  try {
    result.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (_) {
  }
  const offset = (/* @__PURE__ */ new Date()).getTimezoneOffset(), o = Math.abs(offset);
  result.offset = (offset < 0 ? "+" : "-") + ("00" + Math.floor(o / 60)).slice(-2) + ":" + ("00" + o % 60).slice(-2);
  return result;
}

exports.getTimeZoneOffset = getTimeZoneOffset;
exports.isNumeric = isNumeric;
exports.momentTimezonePlayground = momentTimezonePlayground;
exports.moment_format = moment_format;
exports.setDateLocalValue = setDateLocalValue;
//# sourceMappingURL=moment-timezone-helper.cjs.map
//# sourceMappingURL=moment-timezone-helper.cjs.map