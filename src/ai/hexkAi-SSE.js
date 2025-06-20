import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readfile } from 'sbg-utility';

const __filename = fileURLToPath(import.meta.url);

/**
 * Cleans up joined SSE content into a human-readable string.
 *
 * @param {string[]} content - Array of lines.
 * @returns {string} - Cleaned string.
 */
export function cleanContent(content) {
  return content
    .join(' ')
    .replace(/\s+([.,:;!?])/g, '$1') // Remove space before punctuation
    .replace(/`{2,}/g, '```') // Normalize triple backticks
    .replace(/\s*`+\s*/g, '`') // Trim spaces around `
    .replace(/\s+’\s+/g, '’') // Normalize smart quotes
    .replace(/\b’\s+s\b/g, '’s') // Fix `’ s` to `’s`
    .replace(/’\s+/g, '’') // Remove space after quote
    .replace(/\s{2,}/g, ' ') // Collapse multiple spaces
    .trim();
}

/**
 * Extracts a section of content between two tags in raw SSE text.
 *
 * @param {string} raw - Raw SSE string.
 * @param {string} startTag - Start tag like '[ANSWER_START]'.
 * @param {string} endTag - End tag like '[ANSWER_DONE]'.
 * @returns {string[]} - Lines between the tags.
 */
function extractSection(raw, startTag, endTag) {
  const lines = Array.isArray(raw) ? raw : raw.split(/\r?\n/).map((line) => line.replace(/^data:\s?/, ''));

  const start = lines.indexOf(startTag);
  const end = lines.indexOf(endTag);
  return start !== -1 && end !== -1 && end > start ? lines.slice(start + 1, end).filter(Boolean) : [];
}

/**
 * Extracts the raw answer and formats it with code block if present.
 *
 * @param {string | string[]} input - Raw SSE string or pre-parsed lines.
 * @returns {string} - Cleaned and formatted answer.
 */
export function extractAnswerCodeblock(input) {
  if (typeof input === 'string') {
    input = input.split(/\r?\n/);
  }
  input = input.map((line) => line.replace(/^data:\s?/, ''));
  // console.log('Extracting answer codeblock from input:', input);

  const start = input.indexOf('[ANSWER_START]');
  const end = input.indexOf('[ANSWER_DONE]');
  if (start === -1 || end === -1 || end <= start) return '';

  let result = '';
  const answerLines = input.slice(start + 1, end);
  for (let i = 0; i < answerLines.length; i++) {
    const item = answerLines[i];
    // Check for code block start
    const isCodeBlock = answerLines[i] == '``' && answerLines[i + 2] == '`';
    if (isCodeBlock) {
      result += '\n```\n';
      i += 2; // Skip the next two entries (i+1 and i+2)
      continue;
    }
    // Check for space before punctuation
    if (item == '-') {
      if (answerLines[i - 1] == '' && answerLines[i - 2] == '') {
        result += '\n' + item;
        continue;
      }
      // console.log(
      //   `[extractAnswerCodeblock] Dash found in item at index ${i}: "${item}". Previous items: "${answerLines[i - 1]}", "${answerLines[i - 2]}", "${answerLines[i - 3]}"`
      // );
    }
    result += item;
  }
  // Write result and answerLines to .cache/ai as log files
  writeFileSync('.cache/ai/answerResult.log', result, 'utf8');
  writeFileSync('.cache/ai/answerLines.log', answerLines.join('\n'), 'utf8');

  return result;
}

/**
 * Extracts the answer section from raw SSE content as plain text.
 *
 * @param {string} raw - Raw SSE string.
 * @returns {string} - The extracted answer.
 */
export function extractAnswer(raw) {
  return extractSection(raw, '[ANSWER_START]', '[ANSWER_DONE]').join(' ');
}

/**
 * Extracts related questions section from raw SSE content.
 *
 * @param {string} raw - Raw SSE string.
 * @returns {string[]} - Related questions as an array.
 */
export function extractRelatedQuestions(raw) {
  return extractSection(raw, '[RELATE_Q_START]', '[RELATE_Q_DONE]');
}

/**
 * Parses raw SSE content into structured sections.
 *
 * @param {string} raw - Raw SSE string.
 * @returns {{ answer: string, relatedQuestions: string[] }} Parsed result.
 */
export function parseSSE(raw) {
  return {
    answer: extractAnswer(raw),
    relatedQuestions: extractRelatedQuestions(raw)
  };
}

// CLI entry point
if (process.argv[1] === __filename) {
  const read = readfile('.cache/ai/lines.json');
  const array = JSON.parse(read ?? '[]');
  const answer = extractAnswerCodeblock(array);
  console.log(answer, '\n\n', array);
}
