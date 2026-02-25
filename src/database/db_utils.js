/**
 * Converts an input string into a MySQL-compatible database name.
 *
 * Rules applied:
 * - Replaces non-alphanumeric and non-underscore characters with `_`
 * - Removes leading characters until the name starts with a letter
 * - Truncates result to 64 characters
 * - Returns `default` when input is empty or result becomes empty
 *
 * @param name - Source database name.
 * @returns Sanitized database name.
 */
export function toValidMySQLDatabaseName(name) {
  if (!name) return 'default';

  // Replace invalid characters with underscore
  let cleaned = name.replace(/[^a-zA-Z0-9_]/g, '_');

  // Remove leading characters until we hit a letter
  cleaned = cleaned.replace(/^[^a-zA-Z]+/, '');

  // Trim to MySQL max length (64 chars)
  cleaned = cleaned.substring(0, 64);

  // Fallback if empty after cleaning
  if (!cleaned.length) {
    return 'default';
  }

  return cleaned;
}
