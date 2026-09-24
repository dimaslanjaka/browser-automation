var isDebug_1;
var hasRequiredIsDebug;

function requireIsDebug () {
	if (hasRequiredIsDebug) return isDebug_1;
	hasRequiredIsDebug = 1;
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
	isDebug_1 = isDebug;
	return isDebug_1;
}

export { requireIsDebug as __require };
