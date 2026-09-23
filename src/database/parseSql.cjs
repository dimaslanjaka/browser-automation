'use strict';

/**
 * Parse SQL source into individual SQL statements.
 *
 * Supports:
 * - Statements separated by semicolons.
 * - Single-quoted strings.
 * - Double-quoted identifiers/strings.
 * - Backtick-quoted identifiers.
 * - Escaped SQL quotes such as `''`.
 * - Backslash escaping inside quoted strings.
 * - Single-line comments starting with `--`.
 * - MySQL single-line comments starting with `#`.
 * - Block comments.
 *
 * Semicolons inside quoted strings and comments are ignored.
 *
 * @param {string} sql SQL source to parse.
 * @param {Object} [options] Parser options.
 * @param {boolean} [options.keepComments=true]
 * Whether comments should be retained.
 * @param {boolean} [options.includeEmpty=false]
 * Whether empty statements should be included.
 * @param {boolean} [options.trim=true]
 * Whether statements should be trimmed.
 * @param {boolean} [options.requireSemicolon=false]
 * Whether the final statement must end with a semicolon.
 *
 * @returns {string[]} Parsed SQL statements.
 *
 * @throws {TypeError} If sql is not a string.
 * @throws {Error} If a quote or block comment is not terminated.
 *
 * @example
 * const fs = require('node:fs');
 * const parseSql = require('./parse-sql');
 *
 * const sql = fs.readFileSync('./database.sql', 'utf8');
 * const statements = parseSql(sql);
 *
 * console.log(statements);
 */
function parseSql(sql, options = {}) {
  if (typeof sql !== 'string') {
    throw new TypeError('Expected SQL input to be a string.');
  }

  const { keepComments = true, includeEmpty = false, trim = true, requireSemicolon = false } = options;

  /** @type {string[]} */
  const statements = [];

  /** @type {string[]} */
  let buffer = [];

  /** @type {string|null} */
  let quote = null;

  let inLineComment = false;
  let inBlockComment = false;

  /**
   * Append text to the current statement.
   *
   * @param {string} value Text to append.
   * @returns {void}
   */
  function append(value) {
    buffer.push(value);
  }

  /**
   * Get the current statement.
   *
   * @returns {string} Current statement.
   */
  function getStatement() {
    const value = buffer.join('');

    return trim ? value.trim() : value;
  }

  /**
   * Store the current statement and reset the buffer.
   *
   * @param {boolean} terminated Whether the statement ended with a semicolon.
   * @returns {void}
   */
  function flush(terminated) {
    const statement = getStatement();

    if (requireSemicolon && !terminated && statement) {
      throw new Error('SQL statement does not end with a semicolon.');
    }

    if (statement || includeEmpty) {
      statements.push(statement);
    }

    buffer = [];
  }

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];

    /*
     * Inside a line comment.
     */
    if (inLineComment) {
      if (keepComments) {
        append(char);
      }

      if (char === '\n') {
        inLineComment = false;
      }

      continue;
    }

    /*
     * Inside a block comment.
     */
    if (inBlockComment) {
      if (keepComments) {
        append(char);
      }

      if (char === '*' && next === '/') {
        if (keepComments) {
          append(next);
        }

        i += 1;
        inBlockComment = false;
      }

      continue;
    }

    /*
     * Inside a quoted string or identifier.
     */
    if (quote !== null) {
      append(char);

      /*
       * Handle backslash escaping.
       *
       * Example:
       *   'John\\'s'
       */
      if (char === '\\' && next !== undefined) {
        append(next);
        i += 1;
        continue;
      }

      /*
       * Handle SQL quote escaping.
       *
       * Example:
       *   'John''s'
       */
      if (char === quote && next === quote) {
        append(next);
        i += 1;
        continue;
      }

      if (char === quote) {
        quote = null;
      }

      continue;
    }

    /*
     * Start a SQL line comment.
     */
    if (char === '-' && next === '-') {
      if (keepComments) {
        append(char);
        append(next);
      }

      i += 1;
      inLineComment = true;
      continue;
    }

    /*
     * Start a MySQL line comment.
     */
    if (char === '#') {
      if (keepComments) {
        append(char);
      }

      inLineComment = true;
      continue;
    }

    /*
     * Start a block comment.
     */
    if (char === '/' && next === '*') {
      if (keepComments) {
        append(char);
        append(next);
      }

      i += 1;
      inBlockComment = true;
      continue;
    }

    /*
     * Start a quoted string or identifier.
     */
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      append(char);
      continue;
    }

    /*
     * End of SQL statement.
     */
    if (char === ';') {
      flush(true);
      continue;
    }

    append(char);
  }

  if (quote !== null) {
    throw new Error(`Unterminated SQL quote: ${quote}`);
  }

  if (inBlockComment) {
    throw new Error('Unterminated SQL block comment.');
  }

  /*
   * Handle a final statement without a semicolon.
   */
  if (buffer.length > 0) {
    flush(false);
  }

  return statements;
}

module.exports = parseSql;
