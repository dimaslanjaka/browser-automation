import '../chunk-BUSYA2B4.js';
import moment from 'moment';

function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === "") return dateStr;
  const uniqueFormats = [
    { pattern: "YYYY-MM-DD", regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/ },
    { pattern: "DD-MM-YYYY", regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/ },
    { pattern: "YYYY/MM/DD", regex: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/ }
  ];
  for (const { pattern, regex } of uniqueFormats) {
    const match2 = dateStr.match(regex);
    if (match2) {
      const parsed = moment(dateStr, pattern, true);
      if (parsed.isValid()) {
        const year = parsed.year();
        if (year >= 1900 && year <= (/* @__PURE__ */ new Date()).getFullYear() + 10) {
          return parsed.format("DD/MM/YYYY");
        }
      }
    }
  }
  const ambiguousRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = dateStr.match(ambiguousRegex);
  if (match) {
    const [, first, second] = match;
    const firstNum = parseInt(first, 10);
    const secondNum = parseInt(second, 10);
    if (firstNum > 12) {
      const parsed = moment(dateStr, "DD/MM/YYYY", true);
      if (parsed.isValid() && parsed.year() >= 1900 && parsed.year() <= (/* @__PURE__ */ new Date()).getFullYear() + 10) {
        return parsed.format("DD/MM/YYYY");
      }
    }
    if (secondNum > 12) {
      const parsed = moment(dateStr, "MM/DD/YYYY", true);
      if (parsed.isValid() && parsed.year() >= 1900 && parsed.year() <= (/* @__PURE__ */ new Date()).getFullYear() + 10) {
        return parsed.format("DD/MM/YYYY");
      }
    }
    const ddmmParsed = moment(dateStr, "DD/MM/YYYY", true);
    if (ddmmParsed.isValid() && ddmmParsed.year() >= 1900 && ddmmParsed.year() <= (/* @__PURE__ */ new Date()).getFullYear() + 10) {
      return ddmmParsed.format("DD/MM/YYYY");
    }
    const mmddParsed = moment(dateStr, "MM/DD/YYYY", true);
    if (mmddParsed.isValid() && mmddParsed.year() >= 1900 && mmddParsed.year() <= (/* @__PURE__ */ new Date()).getFullYear() + 10) {
      return mmddParsed.format("DD/MM/YYYY");
    }
  }
  return dateStr;
}

export { parseDate };
//# sourceMappingURL=date.js.map
//# sourceMappingURL=date.js.map