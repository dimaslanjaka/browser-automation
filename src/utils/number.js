/**
 * Convert a value to a number when possible.
 *
 * @param {number|string|null|undefined} value - Value to convert. Strings may include non-numeric characters (they will be stripped).
 * @returns {number|null} The parsed number, or `null` if conversion is not possible.
 */
export function toNumber(value) {
  if (typeof value === 'number') {
    return value;
  }
  if (typeof value === 'string') {
    const cleanedValue = value.replace(/[^0-9.-]+/g, '');
    const parsedValue = parseFloat(cleanedValue);
    return isNaN(parsedValue) ? null : parsedValue;
  }
  return null;
}
