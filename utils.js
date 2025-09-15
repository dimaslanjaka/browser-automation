import './chunk-BUSYA2B4.js';
import ansiColors from 'ansi-colors';
import { exec } from 'child_process';
import fs from 'fs-extra';
import moment from 'moment';
import nikParse from 'nik-parser-jurusid';
import path from 'node:path';
import readline from 'node:readline';
import { readfile } from 'sbg-utility';
export * from './utils-browser.js';

function singleBeep() {
  exec("[console]::beep(1000, 500)", { shell: "powershell.exe" });
}
function multiBeep() {
  exec("1..3 | %{ [console]::beep(1000, 500) }", { shell: "powershell.exe" });
}
function waitEnter(message, sound = true) {
  return new Promise(function(resolve) {
    if (sound) singleBeep();
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(message, () => {
      rl.close();
      resolve();
    });
  });
}
const defaultLogFilePath = path.join(process.cwd(), ".cache/lastData.log");
function appendLog(data, message = "Processed Data", logFilePath = null) {
  if (!logFilePath) logFilePath = defaultLogFilePath;
  const logEntry = `${(/* @__PURE__ */ new Date()).toISOString()} - ${message}: ${JSON.stringify(data)}
`;
  fs.appendFileSync(logFilePath, logEntry, "utf8");
}
function getLogData(logFilePath = null) {
  if (!logFilePath) logFilePath = defaultLogFilePath;
  const log = readfile(logFilePath);
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
      const nik_parser_result = nikParse(data.nik);
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
  const parsed = moment(dateStr, formats, true);
  if (!parsed.isValid()) {
    throw new Error(
      `\u274C Invalid birth date format${context ? ` in ${context}` : ""}. Expected one of [${formats.join(", ")}], got: ${dateStr}`
    );
  }
  if (!moment(dateStr, "DD/MM/YYYY", true).isValid()) {
    console.warn(`\u26A0\uFE0F Converted birth date to DD/MM/YYYY: ${parsed.format("DD/MM/YYYY")} (from: ${dateStr})`);
  }
  return parsed.format("DD/MM/YYYY");
}
function colorizeJson(value, indent = 2, level = 0) {
  const space = " ".repeat(indent * level);
  if (value === null) return ansiColors.gray("null");
  if (Array.isArray(value)) {
    if (value.length === 0) return ansiColors.cyan("[]");
    const items = value.map((item) => space + " ".repeat(indent) + colorizeJson(item, indent, level + 1)).join(",\n");
    return ansiColors.cyan("[\n") + items + "\n" + space + ansiColors.cyan("]");
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) return ansiColors.cyan("{}");
    const items = keys.map(
      (key) => space + " ".repeat(indent) + ansiColors.green('"' + key + '"') + ansiColors.cyan(": ") + colorizeJson(value[key], indent, level + 1)
    ).join(",\n");
    return ansiColors.cyan("{\n") + items + "\n" + space + ansiColors.cyan("}");
  }
  if (typeof value === "string") {
    return ansiColors.yellow('"' + value + '"');
  }
  if (typeof value === "number") {
    return ansiColors.magenta(value);
  }
  if (typeof value === "boolean") {
    return ansiColors.blue(value);
  }
  return String(value);
}
function logInline(...args) {
  let output;
  if (args.length > 1) {
    output = args.map((arg) => {
      if (arg === null) {
        return ansiColors.gray("null");
      } else if (typeof arg === "object" && arg !== null) {
        try {
          return colorizeJson(arg);
        } catch (_e) {
          return ansiColors.red("[Unserializable Object]");
        }
      } else if (typeof arg === "number") {
        return ansiColors.magenta(arg);
      } else if (typeof arg === "boolean") {
        return ansiColors.blue(arg);
      }
      return String(arg);
    }).join(" ");
  } else {
    const message = args[0];
    if (message === null) {
      output = ansiColors.gray("null");
    } else if (typeof message === "object" && message !== null) {
      try {
        output = colorizeJson(message);
      } catch (_e) {
        output = ansiColors.red("[Unserializable Object]");
      }
    } else if (typeof message === "number") {
      output = ansiColors.magenta(message);
    } else if (typeof message === "boolean") {
      output = ansiColors.blue(message);
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
        return ansiColors.gray("null");
      } else if (typeof arg === "object" && arg !== null) {
        try {
          return colorizeJson(arg);
        } catch (_e) {
          return ansiColors.red("[Unserializable Object]");
        }
      } else if (typeof arg === "number") {
        return ansiColors.magenta(arg);
      } else if (typeof arg === "boolean") {
        return ansiColors.blue(arg);
      }
      return String(arg);
    }).join(" ");
  } else {
    const message = args[0];
    if (message === null) {
      output = ansiColors.gray("null");
    } else if (typeof message === "object" && message !== null) {
      try {
        output = colorizeJson(message);
      } catch (_e) {
        output = ansiColors.red("[Unserializable Object]");
      }
    } else if (typeof message === "number") {
      output = ansiColors.magenta(message);
    } else if (typeof message === "boolean") {
      output = ansiColors.blue(message);
    } else {
      output = String(message);
    }
  }
  const prefix = global.__lastLogWasInline ? "\n" : "";
  process.stdout.write(`${prefix}${output}
`);
  global.__lastLogWasInline = false;
}

export { appendLog, defaultLogFilePath, enforceDateFormat, getLogData, logInline, logLine, multiBeep, singleBeep, waitEnter };
//# sourceMappingURL=utils.js.map
//# sourceMappingURL=utils.js.map