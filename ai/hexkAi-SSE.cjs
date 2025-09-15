'use strict';

require('../chunk-4IBVXDKH.cjs');
var node_fs = require('node:fs');
var node_url = require('node:url');
var sbgUtility = require('sbg-utility');

var _documentCurrentScript = typeof document !== 'undefined' ? document.currentScript : null;
const __filename$1 = node_url.fileURLToPath((typeof document === 'undefined' ? require('u' + 'rl').pathToFileURL(__filename).href : (_documentCurrentScript && _documentCurrentScript.tagName.toUpperCase() === 'SCRIPT' && _documentCurrentScript.src || new URL('hexkAi-SSE.cjs', document.baseURI).href)));
function cleanContent(content) {
  return content.join(" ").replace(/\s+([.,:;!?])/g, "$1").replace(/`{2,}/g, "```").replace(/\s*`+\s*/g, "`").replace(/\s+’\s+/g, "\u2019").replace(/\b’\s+s\b/g, "\u2019s").replace(/’\s+/g, "\u2019").replace(/\s{2,}/g, " ").trim();
}
function extractSection(raw, startTag, endTag) {
  const lines = Array.isArray(raw) ? raw : raw.split(/\r?\n/).map((line) => line.replace(/^data:\s?/, ""));
  const start = lines.indexOf(startTag);
  const end = lines.indexOf(endTag);
  return start !== -1 && end !== -1 && end > start ? lines.slice(start + 1, end).filter(Boolean) : [];
}
function extractAnswerCodeblock(input) {
  if (typeof input === "string") {
    input = input.split(/\r?\n/);
  }
  input = input.map((line) => line.replace(/^data:\s?/, ""));
  const start = input.indexOf("[ANSWER_START]");
  const end = input.indexOf("[ANSWER_DONE]");
  if (start === -1 || end === -1 || end <= start) return "";
  let result = "";
  const answerLines = input.slice(start + 1, end);
  for (let i = 0; i < answerLines.length; i++) {
    const item = answerLines[i];
    const isCodeBlock = answerLines[i] == "``" && answerLines[i + 2] == "`";
    if (isCodeBlock) {
      result += "\n```\n";
      i += 2;
      continue;
    }
    if (item == "-") {
      if (answerLines[i - 1] == "" && answerLines[i - 2] == "") {
        result += "\n" + item;
        continue;
      }
    }
    result += item;
  }
  node_fs.writeFileSync(".cache/ai/answerResult.log", result, "utf8");
  node_fs.writeFileSync(".cache/ai/answerLines.log", answerLines.join("\n"), "utf8");
  return result;
}
function extractAnswer(raw) {
  return extractSection(raw, "[ANSWER_START]", "[ANSWER_DONE]").join(" ");
}
function extractRelatedQuestions(raw) {
  return extractSection(raw, "[RELATE_Q_START]", "[RELATE_Q_DONE]");
}
function parseSSE(raw) {
  return {
    answer: extractAnswer(raw),
    relatedQuestions: extractRelatedQuestions(raw)
  };
}
if (process.argv[1] === __filename$1) {
  const read = sbgUtility.readfile(".cache/ai/lines.json");
  const array = JSON.parse(read ?? "[]");
  const answer = extractAnswerCodeblock(array);
  console.log(answer, "\n\n", array);
}

exports.cleanContent = cleanContent;
exports.extractAnswer = extractAnswer;
exports.extractAnswerCodeblock = extractAnswerCodeblock;
exports.extractRelatedQuestions = extractRelatedQuestions;
exports.parseSSE = parseSSE;
//# sourceMappingURL=hexkAi-SSE.cjs.map
//# sourceMappingURL=hexkAi-SSE.cjs.map