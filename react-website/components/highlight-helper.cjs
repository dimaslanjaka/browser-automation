'use strict';

require('../../chunk-4IBVXDKH.cjs');
var hljs = require('highlight.js');
var copyToClipboard = require('../../utils/copyToClipboard');
var utilsBrowser_js = require('../../utils-browser.js');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var hljs__default = /*#__PURE__*/_interopDefault(hljs);
var copyToClipboard__default = /*#__PURE__*/_interopDefault(copyToClipboard);

function startHighlighter(preCode) {
  if (!("highlightAll" in hljs__default.default)) return loadHljs();
  let code = preCode;
  if (preCode.tagName.toLowerCase() === "pre") {
    code = preCode.querySelector("code");
    if (!code) {
      const newC = document.createElement("code");
      newC.innerHTML = preCode.innerHTML;
      preCode.innerHTML = "";
      preCode.appendChild(newC);
      code = preCode.querySelector("code");
    }
  }
  if (!code) {
    console.log("pre code is null");
    console.log(preCode);
    return;
  }
  if (!code.id) code.id = "code-" + utilsBrowser_js.randomStr(4);
  if (code.classList.contains("language-mysql")) {
    code.classList.remove("language-mysql");
    code.classList.add("language-sql");
  }
  if (code.hasAttribute("data-highlight")) {
    if (code.getAttribute("data-highlight") !== "false") {
      highlightElement(code);
    }
  } else {
    highlightElement(code);
  }
}
function highlightElement(code) {
  if (!code.hasAttribute("highlighted")) {
    code.setAttribute("highlighted", "true");
    if (hljs__default.default.highlightElement) {
      hljs__default.default.highlightElement(code);
    } else {
      hljs__default.default.highlightBlock(code);
    }
  }
}
function loadHljs() {
  if ("hljs" in window) return;
  utilsBrowser_js.loadJS("//cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js", {
    onload: initHljs
  });
}
function initHljs() {
  document.querySelectorAll("pre").forEach(startHighlighter);
}
function initClipBoard() {
  import('bluebird').then(({ default: Bluebird }) => {
    Bluebird.all(Array.from(document.querySelectorAll("pre"))).each(function(codeBlock) {
      if (!codeBlock.getAttribute("id")) {
        codeBlock.setAttribute("id", utilsBrowser_js.randomStr(4));
      }
      let button = codeBlock.querySelector(".copy-code-button");
      let append = false;
      if (!button) {
        append = true;
        button = document.createElement("button");
        button.className = "copy-code-button";
        button.type = "button";
        const s = codeBlock.innerText;
        button.setAttribute("data-clipboard-text", s);
        button.setAttribute("title", "Copy code block");
        const span = document.createElement("span");
        span.innerText = "Copy";
        button.appendChild(span);
      }
      button.onclick = function(e) {
        const el = document.getElementById(codeBlock.getAttribute("id"));
        copyToClipboard__default.default(el.textContent.replace(/(Copy|Copied)$/gm, ""), e).then(() => {
          e.target.textContent = "Copied";
        }).finally(() => {
          window.setTimeout(() => {
            e.target.textContent = "Copy";
          }, 2e3);
        }).catch(console.error);
      };
      if (append) codeBlock.appendChild(button);
    });
  });
}
if (typeof window !== "undefined" && typeof document !== "undefined") {
  if (document.readyState !== "loading") {
    document.addEventListener("scroll", initHljs);
  } else {
    document.addEventListener("DOMContentLoaded", initHljs);
  }
}

exports.initClipBoard = initClipBoard;
exports.initHljs = initHljs;
//# sourceMappingURL=highlight-helper.cjs.map
//# sourceMappingURL=highlight-helper.cjs.map