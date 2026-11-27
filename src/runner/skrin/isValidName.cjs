/**
 * Checks if a name is valid.
 * @param {*} name - The name to validate.
 * @param {boolean} [debug=false] - Whether to log debug information.
 * @returns {boolean} - True if the name is valid, false otherwise.
 */
function isValidName(name, debug = false) {
  // Check if the name is a string and not empty
  if (typeof name !== 'string' || name.trim() === '') {
    if (debug) {
      console.error('isValidName: name is not a string or is empty');
    }
    return false;
  }

  // name is not only symbols or numbers, it should contain at least one letter
  const hasLetter = /[a-zA-Z]/.test(name);
  if (!hasLetter) {
    if (debug) {
      console.error('isValidName: name must contain at least one letter');
    }
    return false;
  }

  // Check for invalid characters (allow letters, spaces, hyphens, apostrophes, commas, periods)
  const validNamePattern = /^[a-zA-Z\s'.,-]+$/;
  if (!validNamePattern.test(name)) {
    if (debug) {
      console.error('isValidName: name contains invalid characters');
    }
    return false;
  }

  // Check for excessive whitespace (more than one space in a row)
  if (/\s{2,}/.test(name)) {
    if (debug) {
      console.error('isValidName: name contains excessive whitespace');
    }
    return false;
  }

  // Check for leading or trailing whitespace
  if (name !== name.trim()) {
    if (debug) {
      console.error('isValidName: name has leading or trailing whitespace');
    }
    return false;
  }

  return true;
}

module.exports = isValidName;
