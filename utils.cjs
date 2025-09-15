'use strict';

require('./chunk-4IBVXDKH.cjs');
var ansiColors = require('ansi-colors');
var child_process = require('child_process');
var fs = require('fs-extra');
var moment = require('moment');
var nikParse = require('nik-parser-jurusid');
var path = require('node:path');
var readline = require('node:readline');
var sbgUtility = require('sbg-utility');
var utilsBrowser_js = require('./utils-browser.js');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var ansiColors__default = /*#__PURE__*/_interopDefault(ansiColors);
var fs__default = /*#__PURE__*/_interopDefault(fs);
var moment__default = /*#__PURE__*/_interopDefault(moment);
var nikParse__default = /*#__PURE__*/_interopDefault(nikParse);
var path__default = /*#__PURE__*/_interopDefault(path);
var readline__default = /*#__PURE__*/_interopDefault(readline);

function singleBeep() {
  child_process.exec("[console]::beep(1000, 500)", { shell: "powershell.exe" });
}
function multiBeep() {
  child_process.exec("1..3 | %{ [console]::beep(1000, 500) }", { shell: "powershell.exe" });
}
function waitEnter(message, sound = true) {
  return new Promise(function(resolve) {
    if (sound) singleBeep();
    const rl = readline__default.default.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}
const defaultLogFilePath = path__default.default.join(process.cwd(), ".cache/lastData.log");
function appendLog(data, message = "Processed Data", logFilePath = null) {
  if (!logFilePath) logFilePath = defaultLogFilePath;
  const logEntry = `${(/* @__PURE__ */ new Date()).toISOString()} - ${message}: ${JSON.stringify(data)}
`;
  fs__default.default.appendFileSync(logFilePath, logEntry, "utf8");
}
function getLogData(logFilePath = null) {
  if (!logFilePath) logFilePath = defaultLogFilePath;
  const log = sbgUtility.readfile(logFilePath);
  return log.trim().split("\n").map((line) => {
    const match = line.match(/^(.+?) - ([^:]+): (.+)$/);
    if (!match) {
      return {
        raw: line,
        error: "Invalid log line format"
      };
    }
    const [_, timestamp, statusRaw, jsonStr] = match;
    const statusMap = {
      "processed data": "processed",
      "skipped data": "skipped",
      "invalid data": "invalid"
    };
    const status = statusMap[statusRaw.trim().toLowerCase()] || statusRaw.trim().toLowerCase();
    let data;
    try {
      data = JSON.parse(jsonStr);
    } catch (_e) {
      data = { error: "Invalid JSON", raw: jsonStr, line };
    }
    if (!data || typeof data !== "object") {
      throw new Error(
        `Invalid data format at line ${log.split("\n").indexOf(line)}: "${line}" (Log path: ${logFilePath})`
      );
    }
    if (data.error) {
      throw new Error(
        `Error parsing log line at index ${log.split("\n").indexOf(line)}: ${data.error}. Line: "${line}" (Log path: ${logFilePath})`
      );
    }
    if (!data.parsed_nik && data.nik) {
      const nik_parser_result = nikParse__default.default(data.nik);
      if (nik_parser_result.status === "success") {
        if (nik_parser_result.data) {
          data.parsed_nik = nik_parser_result.data;
        }
      }
      if (!data.parsed_nik) {
        throw new Error(`NIK parsing failed for NIK: ${data.nik} at line: "${line}"`);
      }
    }
    return {
      timestamp,
      status,
      data,
      raw: line
      // this is what you asked for
    };
  });
}
function enforceDateFormat(dateStr, formats, context = "") {
  const parsed = moment__default.default(dateStr, formats, true);
  if (!parsed.isValid()) {
    throw new Error(
      `\u274C Invalid birth date format${context ? ` in ${context}` : ""}. Expected one of [${formats.join(", ")}], got: ${dateStr}`
    );
  }
  if (!moment__default.default(dateStr, "DD/MM/YYYY", true).isValid()) {
    console.warn(`\u26A0\uFE0F Converted birth date to DD/MM/YYYY: ${parsed.format("DD/MM/YYYY")} (from: ${dateStr})`);
  }
  return parsed.format("DD/MM/YYYY");
}
function colorizeJson(value, indent = 2, level = 0) {
  const space = " ".repeat(indent * level);
  if (value === null) return ansiColors__default.default.gray("null");
  if (Array.isArray(value)) {
    if (value.length === 0) return ansiColors__default.default.cyan("[]");
    const items = value.map((item) => space + " ".repeat(indent) + colorizeJson(item, indent, level + 1)).join(",\n");
    return ansiColors__default.default.cyan("[\n") + items + "\n" + space + ansiColors__default.default.cyan("]");
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) return ansiColors__default.default.cyan("{}");
    const items = keys.map(
      (key) => space + " ".repeat(indent) + ansiColors__default.default.green('"' + key + '"') + ansiColors__default.default.cyan(": ") + colorizeJson(value[key], indent, level + 1)
    ).join(",\n");
    return ansiColors__default.default.cyan("{\n") + items + "\n" + space + ansiColors__default.default.cyan("}");
  }
  if (typeof value === "string") {
    return ansiColors__default.default.yellow('"' + value + '"');
  }
  if (typeof value === "number") {
    return ansiColors__default.default.magenta(value);
  }
  if (typeof value === "boolean") {
    return ansiColors__default.default.blue(value);
  }
  return String(value);
}
function logInline(...args) {
  let output;
  if (args.length > 1) {
    output = args.map((arg) => {
      if (arg === null) {
        return ansiColors__default.default.gray("null");
      } else if (typeof arg === "object" && arg !== null) {
        try {
          return colorizeJson(arg);
        } catch (_e) {
          return ansiColors__default.default.red("[Unserializable Object]");
        }
      } else if (typeof arg === "number") {
        return ansiColors__default.default.magenta(arg);
      } else if (typeof arg === "boolean") {
        return ansiColors__default.default.blue(arg);
      }
      return String(arg);
    }).join(" ");
  } else {
    const message = args[0];
    if (message === null) {
      output = ansiColors__default.default.gray("null");
    } else if (typeof message === "object" && message !== null) {
      try {
        output = colorizeJson(message);
      } catch (_e) {
        output = ansiColors__default.default.red("[Unserializable Object]");
      }
    } else if (typeof message === "number") {
      output = ansiColors__default.default.magenta(message);
    } else if (typeof message === "boolean") {
      output = ansiColors__default.default.blue(message);
    } else {
      output = String(message);
    }
  }
  process.stdout.write(`\r${output}`);
  global.__lastLogWasInline = true;
}
function logLine(...args) {
  let output;
  if (args.length > 1) {
    output = args.map((arg) => {
      if (arg === null) {
        return ansiColors__default.default.gray("null");
      } else if (typeof arg === "object" && arg !== null) {
        try {
          return colorizeJson(arg);
        } catch (_e) {
          return ansiColors__default.default.red("[Unserializable Object]");
        }
      } else if (typeof arg === "number") {
        return ansiColors__default.default.magenta(arg);
      } else if (typeof arg === "boolean") {
        return ansiColors__default.default.blue(arg);
      }
      return String(arg);
    }).join(" ");
  } else {
    const message = args[0];
    if (message === null) {
      output = ansiColors__default.default.gray("null");
    } else if (typeof message === "object" && message !== null) {
      try {
        output = colorizeJson(message);
      } catch (_e) {
        output = ansiColors__default.default.red("[Unserializable Object]");
      }
    } else if (typeof message === "number") {
      output = ansiColors__default.default.magenta(message);
    } else if (typeof message === "boolean") {
      output = ansiColors__default.default.blue(message);
    } else {
      output = String(message);
    }
  }
  const prefix = global.__lastLogWasInline ? "\n" : "";
  process.stdout.write(`${prefix}${output}
`);
  global.__lastLogWasInline = false;
}

exports.appendLog = appendLog;
exports.defaultLogFilePath = defaultLogFilePath;
exports.enforceDateFormat = enforceDateFormat;
exports.getLogData = getLogData;
exports.logInline = logInline;
exports.logLine = logLine;
exports.multiBeep = multiBeep;
exports.singleBeep = singleBeep;
exports.waitEnter = waitEnter;
Object.keys(utilsBrowser_js).forEach(function (k) {
  if (k !== 'default' && !Object.prototype.hasOwnProperty.call(exports, k)) Object.defineProperty(exports, k, {
    enumerable: true,
    get: function () { return utilsBrowser_js[k]; }
  });
});
//# sourceMappingURL=utils.cjs.map
//# sourceMappingURL=utils.cjs.map