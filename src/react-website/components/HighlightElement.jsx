import React from 'react';
import { initHljs } from './highlight-helper.js';
import { randomStr } from '../../utils-browser.js';

// css for browser
// '//cdn.jsdelivr.net/gh/highlightjs/cdn-release@9.16.2/build/styles/default.min.css'
// css for local
// @import 'highlight.js/styles/github-dark.css';

/**
 * @typedef {Object} HighlightProps
 * @property {string} [lang] - specify language (applied to `<code />` tag)
 * @property {boolean} [data-highlight] - enable highlighting? (applied to `<code />` tag)
 * @property {string} [id] - custom id (applied to `<pre />` tag)
 * @property {string} [className] - custom class names (applied to `<pre />` tag)
 * @property {React.ReactNode} [children] - content inside the code block
 * @property {any} [key] - additional dynamic props
 */

/**
 * @extends {React.Component<HighlightProps, Record<string, any>>}
 */
class HighlightElement extends React.Component {
  constructor(props) {
    super(props);
  }

  componentDidMount() {
    initHljs();
    // window.addEventListener('load', helper.initHljs.bind(this));
  }

  componentWillUnmount() {
    // window.removeEventListener('load', helper.initHljs.bind(this));
  }

  render() {
    /** @type {Record<string, any>} */
    const buildProps = {};

    if (this.props.lang) {
      buildProps.className = 'hljs language-' + this.getLang();
    }

    if (this.props['data-highlight']) {
      buildProps['data-highlight'] = String(this.props['data-highlight']);
    }

    const classNames = ['hljs', ...(this.props.className ? this.props.className.split(' ') : [])]
      .filter((v, i, arr) => v && arr.indexOf(v) === i)
      .join(' ');
    return (
      <pre id={this.props.id || 'pre-' + randomStr(3)} className={classNames}>
        <code {...buildProps}>{this.props.children}</code>
        <button
          className="copy-code-button"
          type="button"
          title="Copy code block"
          data-clipboard-text={this.props.children}>
          <span>Copy</span>
        </button>
      </pre>
    );
  }

  /**
   * Maps short language codes to full names
   * @returns {string | undefined}
   */
  getLang() {
    const { lang } = this.props;
    const map = {
      js: 'javascript',
      kt: 'kotlin',
      ts: 'typescript',
      mysql: 'sql'
    };
    if (lang in map) {
      return map[lang];
    } else {
      return lang;
    }
  }
}

export default HighlightElement;
