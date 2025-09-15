'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

require('./chunk-4IBVXDKH.cjs');
var fs = require('fs');
var path = require('path');
var url = require('url');
var colors = require('ansi-colors');

var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var fs__default = /*#__PURE__*/_interopDefault(fs);
var path__default = /*#__PURE__*/_interopDefault(path);
var colors__default = /*#__PURE__*/_interopDefault(colors);

const __filename$1 = url.fileURLToPath((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('logger.cjs', document.baseURI).href)));
path__default.default.dirname(__filename$1);
const LOG_FILE_PATH = path__default.default.resolve(process.cwd(), ".cache/logs/log.txt");
const logDir = path__default.default.dirname(LOG_FILE_PATH);
if (!fs__default.default.existsSync(logDir)) {
  fs__default.default.mkdirSync(logDir, { recursive: true });
}
function getTimestamp() {
  return (/* @__PURE__ */ new Date()).toISOString();
}
function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}
function colorize(value) {
  if (value === null) return colors__default.default.magenta("null");
  if (value === void 0) return colors__default.default.gray("undefined");
  const type = typeof value;
  switch (type) {
    case "string":
      return colors__default.default.white(`"${value}"`);
    case "number":
      return colors__default.default.blue(value);
    case "boolean":
      return colors__default.default.green(value);
    case "object":
      if (Array.isArray(value)) {
        const items = value.map((item) => colorize(item)).join(", ");
        return colors__default.default.yellow(`[${items}]`);
      } else {
        const entries = Object.entries(value).map(([k, v]) => `${colors__default.default.cyan(k)}: ${colorize(v)}`).join(", ");
        return `{ ${entries} }`;
      }
    default:
      return colors__default.default.red(`[Unsupported: ${type}]`);
  }
}
function logToFile(message) {
  const clean = stripAnsi(message);
  fs__default.default.appendFileSync(LOG_FILE_PATH, `[${getTimestamp()}] ${clean}
`, "utf8");
}
function log(...args) {
  const timestamp = colors__default.default.gray(`[${getTimestamp()}]`);
  const colorizedArgs = args.map(colorize).join(" ");
  const rawArgs = args.map((arg) => {
    try {
      return typeof arg === "string" ? arg : JSON.stringify(arg);
    } catch {
      return "[Unserializable]";
    }
  }).join(" ");
  const fullMessage = `${timestamp} ${colorizedArgs}`;
  console.log(fullMessage);
  logToFile(rawArgs);
}
function info(...args) {
  log(colors__default.default.cyan("[INFO]"), ...args);
}
function warn(...args) {
  log(colors__default.default.yellow("[WARN]"), ...args);
}
function error(...args) {
  log(colors__default.default.red("[ERROR]"), ...args);
}
var logger_default = {
  log,
  info,
  warn,
  error
};

exports.default = logger_default;
exports.error = error;
exports.info = info;
exports.log = log;
exports.warn = warn;
//# sourceMappingURL=logger.cjs.map
//# sourceMappingURL=logger.cjs.map