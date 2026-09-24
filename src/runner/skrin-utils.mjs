import 'path';
import 'fs';
import 'xlsx';
import 'bluebird';
import '../../_virtual/waitEnter.mjs';
import '../../_virtual/logs.mjs';
import '../utils/beep.mjs';
import 'moment-timezone';

/**
 * Parse baby name from entry string
 *
 * Extracts baby name from various formats:
 * - "Mother Name, BY (Baby Name)" format or "Mother Name, BY" at the end
 * - "/Baby Name" format at the end (returns mother name if baby name is "BAYI")
 * - "(Baby Name)" parenthesized format
 *
 * @param {string} entry - The entry string containing baby name information
 * @returns {string|undefined} Extracted baby name or undefined if no match found
 */
function parseBabyName(entry) {
    let result = undefined;
    // Match "Baby Name / Mother Name, BY" format first (has priority over simple "Mother Name, BY")
    let match = entry.match(/\/\s*(.+?),\s*(BY|AN)(?:\s*\((.+))?$/i);
    if (match) {
        result = match[1].trim();
        return result; // Return early
    }
    // Match "Mother Name, BY (Baby Name)" or "Mother Name, BY" at the end
    match = entry.match(/^([^,]+),\s*(BY|AN)(?:\s*\((.+))?$/i);
    if (match) {
        result = match[1].trim();
        return result; // Return early to avoid being overwritten by parentheses match
    }
    match = entry.match(/\/\s*([A-Z].+)$/i);
    if (match) {
        const extractedPart = match[1].replace(/[,)]\s*$/g, '').trim();
        // If the extracted part is just "BAYI" or starts with "BY/AN", return the part before the slash
        if (/^bayi$/i.test(extractedPart) || /^(by|an)\s/i.test(extractedPart)) {
            result = entry.replace(/\s*\/\s*(.+)$/i, '').trim();
        }
        else {
            result = extractedPart;
        }
        return result; // Return early to avoid being overwritten by parentheses match
    }
    match = entry.match(/\(([^)]+)\)/);
    if (match)
        result = match[1].trim();
    return result;
}

export { parseBabyName };
