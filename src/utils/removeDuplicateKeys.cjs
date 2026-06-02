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

module.exports = removeDuplicateKeys;
