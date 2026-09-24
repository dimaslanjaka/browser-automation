var removeDuplicateKeys_1;
var hasRequiredRemoveDuplicateKeys;

function requireRemoveDuplicateKeys () {
	if (hasRequiredRemoveDuplicateKeys) return removeDuplicateKeys_1;
	hasRequiredRemoveDuplicateKeys = 1;
	/**
	 * Removes duplicate keys from an object, keeping the first occurrence
	 * when keys differ only by case. Keys are normalized to lowercase.
	 *
	 * @param {Record<string, unknown>} obj - The input object with potentially duplicate keys.
	 * @returns {Record<string, unknown>} A new object with unique lowercase keys.
	 *
	 * @example
	 * removeDuplicateKeys({ Foo: 1, foo: 2, BAR: 3 });
	 * // => { foo: 1, bar: 3 }
	 */
	function removeDuplicateKeys(obj) {
	    const result = {};
	    for (const [key, value] of Object.entries(obj)) {
	        const normalized = key.toLowerCase();
	        // Keep first occurrence
	        if (!(normalized in result)) {
	            result[normalized] = value;
	        }
	    }
	    return result;
	}
	removeDuplicateKeys_1 = removeDuplicateKeys;
	return removeDuplicateKeys_1;
}

export { requireRemoveDuplicateKeys as __require };
