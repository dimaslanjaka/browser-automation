import moment from 'moment-timezone';

const logs = new Map();

/**
 * Add a log entry
 * @param {{id: string, data: any, message: string}} param0
 */
export function addLog({ id, data, message }) {
  logs.set(id, {
    id,
    data,
    message,
    // Use moment-timezone to format timestamp in RFC 3999 with Asia/Jakarta timezone
    timestamp: moment().tz('Asia/Jakarta').format('YYYY-MM-DDTHH:mm:ssZ')
  });
}

/**
 * Remove a log entry by id
 * @param {string} id
 */
export function removeLog(id) {
  return logs.delete(id);
}

/**
 * Get a log entry by id
 * @param {string} id
 * @returns {object | undefined}
 */
export function getLogById(id) {
  return logs.get(id);
}

/**
 * Get all logs or filtered logs
 * @param {(log: object) => boolean} [filterFn]
 * @returns {Array}
 */
export function getLogs(filterFn = () => true) {
  return Array.from(logs.values()).filter(filterFn);
}
