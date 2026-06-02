/**
 * Checks whether debug mode is enabled.
 *
 * Returns `true` when `globalThis.DEBUG` is `true` (set by the JS hook)
 * or `process.env.DEBUG` is the string `'true'`.
 *
 * @returns {boolean} `true` if debug mode is enabled, `false` otherwise.
 *
 * @example
 * isDebug(); // true when DEBUG is truthy
 */
function isDebug() {
  return typeof globalThis.DEBUG !== 'undefined' ? globalThis.DEBUG : process.env.DEBUG === 'true';
}

module.exports = isDebug;
