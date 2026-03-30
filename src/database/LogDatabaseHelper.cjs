const moment = require('moment-timezone');

/**
 * Get current Jakarta time.
 * If a moment format string is provided, return formatted string.
 * Otherwise return ISO8601 with milliseconds and offset.
 *
 * @param {string} [format]
 * @returns {string}
 */
function getJakartaTimestamp(format) {
  const t = moment().tz('Asia/Jakarta');
  if (format) return t.format(format);
  return t.format('YYYY-MM-DDTHH:mm:ss.SSSZ');
}

module.exports = { getJakartaTimestamp };

// Current Jakarta time: 2026-03-31T04:28:30.051+07:00
// Another format: 2026-03-31T04:28:30+07:00
// console.log('Current Jakarta time:', getJakartaTimestamp());
// console.log('Another format:', moment().tz('Asia/Jakarta').format('YYYY-MM-DDTHH:mm:ssZ'));
