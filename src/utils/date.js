import moment from 'moment';

/**
 * Automatically detects and parses date format from a string
 * Supports multiple date formats and uses heuristics to distinguish between ambiguous formats
 * @param {string} dateStr - The date string to parse
 * @returns {string} The formatted date in DD/MM/YYYY format, or original string if parsing fails
 */
export function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return dateStr;

  // First, try formats with unique patterns
  const uniqueFormats = [
    { pattern: 'YYYY-MM-DD', regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/ },
    { pattern: 'DD-MM-YYYY', regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/ },
    { pattern: 'YYYY/MM/DD', regex: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/ }
  ];

  for (const { pattern, regex } of uniqueFormats) {
    const match = dateStr.match(regex);
    if (match) {
      const parsed = moment(dateStr, pattern, true);
      if (parsed.isValid()) {
        const year = parsed.year();
        if (year >= 1900 && year <= new Date().getFullYear() + 10) {
          return parsed.format('DD/MM/YYYY');
        }
      }
    }
  }

  // Handle ambiguous DD/MM/YYYY vs MM/DD/YYYY formats
  const ambiguousRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = dateStr.match(ambiguousRegex);
  if (match) {
    const [, first, second] = match;
    const firstNum = parseInt(first, 10);
    const secondNum = parseInt(second, 10);

    // Heuristics to determine format:
    // 1. If first number > 12, it must be DD/MM/YYYY
    if (firstNum > 12) {
      const parsed = moment(dateStr, 'DD/MM/YYYY', true);
      if (parsed.isValid() && parsed.year() >= 1900 && parsed.year() <= new Date().getFullYear() + 10) {
        return parsed.format('DD/MM/YYYY');
      }
    }

    // 2. If second number > 12, it must be MM/DD/YYYY
    if (secondNum > 12) {
      const parsed = moment(dateStr, 'MM/DD/YYYY', true);
      if (parsed.isValid() && parsed.year() >= 1900 && parsed.year() <= new Date().getFullYear() + 10) {
        return parsed.format('DD/MM/YYYY');
      }
    }

    // 3. If both numbers <= 12, try DD/MM/YYYY first (more common format)
    const ddmmParsed = moment(dateStr, 'DD/MM/YYYY', true);
    if (ddmmParsed.isValid() && ddmmParsed.year() >= 1900 && ddmmParsed.year() <= new Date().getFullYear() + 10) {
      return ddmmParsed.format('DD/MM/YYYY');
    }

    // 4. Fallback to MM/DD/YYYY
    const mmddParsed = moment(dateStr, 'MM/DD/YYYY', true);
    if (mmddParsed.isValid() && mmddParsed.year() >= 1900 && mmddParsed.year() <= new Date().getFullYear() + 10) {
      return mmddParsed.format('DD/MM/YYYY');
    }
  }

  // If no format matches, return original
  return dateStr;
}
