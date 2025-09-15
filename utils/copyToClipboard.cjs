'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

require('../chunk-4IBVXDKH.cjs');

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch((err) => {
      console.warn("Copy to clipboard failed.", err);
      return prompt("Copy to clipboard: Ctrl+C, Enter", text);
    });
  } else if (window.clipboardData && window.clipboardData.setData) {
    return window.clipboardData.setData("Text", text);
  } else if (document.queryCommandSupported && document.queryCommandSupported("copy")) {
    var textarea = document.createElement("textarea");
    textarea.textContent = text;
    textarea.style.position = "fixed";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      return document.execCommand("copy");
    } catch (ex) {
      console.warn("Copy to clipboard failed.", ex);
      return prompt("Copy to clipboard: Ctrl+C, Enter", text);
    } finally {
      document.body.removeChild(textarea);
    }
  }
}
var copyToClipboard_default = copyToClipboard;

exports.copyToClipboard = copyToClipboard;
exports.default = copyToClipboard_default;
//# sourceMappingURL=copyToClipboard.cjs.map
//# sourceMappingURL=copyToClipboard.cjs.map