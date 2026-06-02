/**
 * Checks whether the current environment is development mode.
 *
 * Returns `true` when `NODE_ENV` is not explicitly set to `'production'`.
 *
 * @returns {boolean} `true` if in development mode, `false` otherwise.
 *
 * @example
 * isDev(); // true when NODE_ENV !== 'production'
 */
function isDev() {
  return process.env.NODE_ENV !== 'production';
}

module.exports = isDev;
