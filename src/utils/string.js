/**
 * Converts the first character of each word in a string to uppercase.
 *
 * @param {string} str - The input string to be transformed.
 * @returns {string} The transformed string with each word's first letter in uppercase.
 */
export function ucwords(str) {
  // Lowercase the whole string first, then capitalize first letter of each word
  // Lowercase the string, then capitalize the first character of each word
  // Capitalize only the first character of each word, preserve the rest of the word's casing
  // Capitalize first character of each word, lowercase the rest of the word
  // Capitalize only the first character of each word, preserve the rest of the word's casing
  // Capitalize first character of each word, lowercase the rest, support non-ASCII and word boundaries
  return str.replace(/([A-Za-zÀ-ÖØ-öø-ÿ]+(?:['’][A-Za-zÀ-ÖØ-öø-ÿ]+)?)/g, (word) => {
    // If the word is all uppercase, convert to capitalized
    if (/^[A-ZÀ-ÖØ-Þ]+$/.test(word)) {
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    }
    // Otherwise, only capitalize the first character
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
}

/**
 * Remove all whitespace characters from a string.
 *
 * This collapses and removes spaces, tabs, newlines, and other Unicode
 * whitespace characters from the input. If the input is an empty string,
 * the function returns an empty string.
 *
 * @param {string} str - The input string to process.
 * @returns {string} The input string with all whitespace removed.
 * @example
 * // returns 'helloWorld'
 * removeWhitespaces('hello World')
 */
export function removeWhitespaces(str) {
  return str.replace(/\s+/g, '');
}
