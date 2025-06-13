import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import colors from 'ansi-colors';

// Resolve __dirname di ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_FILE_PATH = path.resolve(process.cwd(), '.cache/logs/log.txt');
const logDir = path.dirname(LOG_FILE_PATH);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

function getTimestamp() {
  return new Date().toISOString();
}

function stripAnsi(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function colorize(value) {
  if (value === null) return colors.magenta('null');
  if (value === undefined) return colors.gray('undefined');

  const type = typeof value;

  switch (type) {
    case 'string':
      return colors.white(`"${value}"`);
    case 'number':
      return colors.blue(value);
    case 'boolean':
      return colors.green(value);
    case 'object':
      if (Array.isArray(value)) {
        const items = value.map((item) => colorize(item)).join(', ');
        return colors.yellow(`[${items}]`);
      } else {
        const entries = Object.entries(value)
          .map(([k, v]) => `${colors.cyan(k)}: ${colorize(v)}`)
          .join(', ');
        return `{ ${entries} }`;
      }
    default:
      return colors.red(`[Unsupported: ${type}]`);
  }
}

function logToFile(message) {
  const clean = stripAnsi(message);
  fs.appendFileSync(LOG_FILE_PATH, `[${getTimestamp()}] ${clean}\n`, 'utf8');
}

function log(...args) {
  const timestamp = colors.gray(`[${getTimestamp()}]`);
  const colorizedArgs = args.map(colorize).join(' ');
  const rawArgs = args
    .map((arg) => {
      try {
        return typeof arg === 'string' ? arg : JSON.stringify(arg);
      } catch {
        return '[Unserializable]';
      }
    })
    .join(' ');

  const fullMessage = `${timestamp} ${colorizedArgs}`;
  console.log(fullMessage);
  logToFile(rawArgs);
}

function info(...args) {
  log(colors.cyan('[INFO]'), ...args);
}

function warn(...args) {
  log(colors.yellow('[WARN]'), ...args);
}

function error(...args) {
  log(colors.red('[ERROR]'), ...args);
}

export { log, info, warn, error };
export default {
  log,
  info,
  warn,
  error
};
