/**
 * Pick the first non-empty, non-null, non-undefined value from a list.
 * @param {...*} values - Values to check in order.
 * @returns {*} The first valid value or null.
 */
export function pickValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return value;
    }
  }
  return null;
}
