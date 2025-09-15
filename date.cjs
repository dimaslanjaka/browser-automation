'use strict';

require('./chunk-4IBVXDKH.cjs');
var moment = require('moment-timezone');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var moment__default = /*#__PURE__*/_interopDefault(moment);

function getAge(dateString, dateFormat = "DD/MM/YYYY") {
  let birthDate = moment__default.default(dateString, dateFormat, true);
  if (!birthDate.isValid()) {
    throw new Error(`Invalid date format: "${dateString}". Expected format: ${dateFormat}`);
  }
  let age = moment__default.default().diff(birthDate, "years");
  return Math.max(0, age);
}
function getDatesWithoutSundays(monthName, year = (/* @__PURE__ */ new Date()).getFullYear(), format = "YYYY-MM-DD", limitToToday = false) {
  const monthMap = {
    january: 0,
    februari: 1,
    february: 1,
    maret: 2,
    march: 2,
    april: 3,
    mei: 4,
    may: 4,
    juni: 5,
    june: 5,
    juli: 6,
    july: 6,
    agustus: 7,
    august: 7,
    september: 8,
    oktober: 9,
    october: 9,
    november: 10,
    desember: 11,
    december: 11
  };
  const key = monthName.toLowerCase();
  if (!(key in monthMap)) {
    throw new Error(`Unrecognized month name: "${monthName}"`);
  }
  const formatDate = (date) => {
    const pad = (n) => n.toString().padStart(2, "0");
    const YYYY = date.getFullYear();
    const MM = pad(date.getMonth() + 1);
    const DD = pad(date.getDate());
    switch (format) {
      case "YYYY-MM-DD":
        return `${YYYY}-${MM}-${DD}`;
      case "DD/MM/YYYY":
        return `${DD}/${MM}/${YYYY}`;
      case "MM-DD-YYYY":
        return `${MM}-${DD}-${YYYY}`;
      default:
        throw new Error(`Unsupported date format: "${format}"`);
    }
  };
  const today = /* @__PURE__ */ new Date();
  const month = monthMap[key];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const dateList = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    if (date.getDay() === 0) continue;
    if (limitToToday && date > today) break;
    dateList.push(formatDate(date));
  }
  return dateList;
}
function containsMonth(str) {
  const monthRegex = /\b(january|february|march|april|may|june|july|august|september|october|november|december|januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b/i;
  return monthRegex.test(str);
}
function extractMonthName(str) {
  const monthRegex = /\b(january|february|march|april|may|june|july|august|september|october|november|december|januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\b/i;
  const match = str.match(monthRegex);
  return match ? match[0] : null;
}

exports.containsMonth = containsMonth;
exports.extractMonthName = extractMonthName;
exports.getAge = getAge;
exports.getDatesWithoutSundays = getDatesWithoutSundays;
//# sourceMappingURL=date.cjs.map
//# sourceMappingURL=date.cjs.map