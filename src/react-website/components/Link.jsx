import React from 'react';
import { Link as OriginalLink } from 'react-router-dom';
import * as safelinkify from 'safelinkify';

export const safelinkInstance = new safelinkify.safelink({
  // exclude patterns (dont anonymize these patterns)
  exclude: [/([a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?[.])*webmanajemen\.com/],
  // url redirector
  redirect: 'https://www.webmanajemen.com/page/safelink.html?url=',
  // debug
  verbose: false,
  // encryption type = 'base64' | 'aes'
  type: 'base64',
  // password aes, default = root
  password: 'unique-password'
});

/**
 * validate url
 * @param {string} str
 * @returns {boolean}
 */
export function isValidHttpUrl(str) {
  let url;

  try {
    url = new URL(str);
  } catch (_) {
    return false;
  }

  return url.protocol === 'http:' || url.protocol === 'https:';
}

/**
 * React Safelink Converter
 * Anonymize external links into page redirector
 *
 * @typedef {Object} LinkProps
 * @property {string} [href] - Target URL
 * @property {string} [to] - Same as href
 * @property {string} [target] - Open in target tab
 * @property {string} [className] - Class names
 * @property {string} [title] - Link title
 * @property {string} [rel] - Rel attribute
 * @property {React.ReactNode} [children] - Link content
 * @property {any} [key] - React key
 * @property {any} [otherProps] - Any other props
 */
class Link extends React.Component {
  constructor(props) {
    super(props);
    this.sf = safelinkInstance;
  }

  render() {
    const { href, to, ...props } = this.props;
    const dest = href || to;
    let result = dest;
    let type = 'internal';
    if (typeof dest === 'string') {
      if (isValidHttpUrl(dest)) {
        result = this.sf.parseUrl(dest);
        if (result === dest) {
          type = 'internal';
        } else {
          type = 'external';
        }
      }
    }

    let render;

    if (type === 'external') {
      render = (
        <a {...props} href={result} target="_blank">
          {this.props.children}
        </a>
      );
    } else {
      render = (
        <OriginalLink {...props} to={dest}>
          {this.props.children}
        </OriginalLink>
      );
    }

    return render;
  }
}

export default Link;
