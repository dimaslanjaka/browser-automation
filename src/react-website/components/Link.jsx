import React from 'react';
import { Link as OriginalLink } from 'react-router-dom';
import { getSafelinkInstance, isValidHttpUrl } from './utils.js';

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
    this.state = { sf: null };
    this._isMounted = false;
  }

  async componentDidMount() {
    this._isMounted = true;
    const sf = await getSafelinkInstance();
    if (this._isMounted) {
      this.setState({ sf });
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  render() {
    const { href, to, ...props } = this.props;
    const dest = href || to;
    let result = dest;
    let type = 'internal';
    const { sf } = this.state;
    if (typeof dest === 'string' && sf) {
      if (isValidHttpUrl(dest)) {
        result = sf.parseUrl(dest);
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
        <a {...props} href={result} target="_blank" rel="noreferrer">
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
