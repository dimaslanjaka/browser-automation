import hljs from 'highlight.js';
import copyToClipboard from '../../utils/copyToClipboard';
import { loadJS, randomStr } from '../../utils-browser.js';

/**
 * Start highlighting for a given <pre> or <code> element.
 * @param {HTMLElement} preCode
 */
function startHighlighter(preCode) {
  // validate hljs for browser
  // if ('hljs' in window === false) return loadHljs();
  // validate hljs for React
  if (!('highlightAll' in hljs)) return loadHljs();

  /** @type {HTMLElement|null} */
  let code = preCode;
  if (preCode.tagName.toLowerCase() === 'pre') {
    // select inner <code /> from <pre /> tag
    code = preCode.querySelector('code');
    if (!code) {
      // create <code /> tag on single <pre /> tag
      const newC = document.createElement('code');
      newC.innerHTML = preCode.innerHTML;
      preCode.innerHTML = '';
      preCode.appendChild(newC);
      code = preCode.querySelector('code');
    }
  }

  if (!code) {
    console.log('pre code is null');
    console.log(preCode);
    return;
  }

  // add new id
  if (!code.id) code.id = 'code-' + randomStr(4);

  // fix mysql highlight
  if (code.classList.contains('language-mysql')) {
    code.classList.remove('language-mysql');
    code.classList.add('language-sql');
  }

  // start highlight pre code[data-highlight]
  if (code.hasAttribute('data-highlight')) {
    if (code.getAttribute('data-highlight') !== 'false') {
      highlightElement(code);
    }
  } else {
    // highlight no attribute data-highlight — enable by default
    highlightElement(code);
  }
}

/**
 * Highlight a <code> element using Highlight.js
 * @param {HTMLElement} code
 */
function highlightElement(code) {
  if (!code.hasAttribute('highlighted')) {
    code.setAttribute('highlighted', 'true');
    if (hljs.highlightElement) {
      hljs.highlightElement(code);
    } else {
      hljs.highlightBlock(code);
    }
  }
}

/**
 * Load Highlight.js from CDN if not already loaded
 */
function loadHljs() {
  if ('hljs' in window) return;
  loadJS('//cdnjs.cloudflare.com/ajax/libs/highlight.js/11.8.0/highlight.min.js', {
    onload: initHljs
  });
}

/**
 * Initialize syntax highlighting for all <pre> blocks
 */
export function initHljs() {
  document.querySelectorAll('pre').forEach(startHighlighter);

  // Alternative full document highlight (if needed)
  /*
  if ("initHighlightingOnLoad" in hljs) {
    hljs.initHighlightingOnLoad();
  } else if ("highlightAll" in hljs) {
    hljs.highlightAll();
  }
  */
}

/**
 * Initialize copy-to-clipboard functionality on code blocks
 */
export function initClipBoard() {
  import('bluebird').then(({ default: Bluebird }) => {
    Bluebird.all(Array.from(document.querySelectorAll('pre'))).each(function (codeBlock) {
      if (!codeBlock.getAttribute('id')) {
        codeBlock.setAttribute('id', randomStr(4));
      }

      /** @type {HTMLButtonElement|null} */
      let button = codeBlock.querySelector('.copy-code-button');
      let append = false;

      if (!button) {
        append = true;
        button = document.createElement('button');
        button.className = 'copy-code-button';
        button.type = 'button';
        const s = codeBlock.innerText;
        button.setAttribute('data-clipboard-text', s);
        button.setAttribute('title', 'Copy code block');

        const span = document.createElement('span');
        span.innerText = 'Copy';
        button.appendChild(span);
      }

      button.onclick = function (e) {
        const el = document.getElementById(codeBlock.getAttribute('id'));
        copyToClipboard(el.textContent.replace(/(Copy|Copied)$/gm, ''), e)
          .then(() => {
            e.target.textContent = 'Copied';
          })
          .finally(() => {
            window.setTimeout(() => {
              e.target.textContent = 'Copy';
            }, 2000);
          })
          .catch(console.error);
      };

      if (append) codeBlock.appendChild(button);
    });
  });
}

/** Main auto-init for browsers */
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  if (document.readyState !== 'loading') {
    document.addEventListener('scroll', initHljs);
    // triggerAdsense(undefined);
  } else {
    document.addEventListener('DOMContentLoaded', initHljs);
  }
}
