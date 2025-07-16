import React from 'react';
import { Container } from 'react-bootstrap';
import { useTheme } from './ThemeContext.jsx';
import siteInfo from './site-information.json' with { type: 'json' };
import socialMedia from './social-media.json' with { type: 'json' };

const _react = typeof React;

export default function Footer() {
  const { theme } = useTheme();
  return (
    <footer
      style={{ backgroundColor: theme === 'dark' ? '#23272f' : '#f8f9fa' }}
      className={`p-3 mt-4 border-top ${theme === 'dark' ? 'text-light' : 'text-dark'}`}
    >
      <Container>
        <div className="d-flex justify-content-between align-items-center">
          <small>&copy; 2025 {siteInfo.title}</small>
          <div>
            {socialMedia.facebook && (
              <a href={socialMedia.facebook} target="_blank" rel="noopener" aria-label="Facebook" className="mx-2">
                <i
                  className="fab fa-facebook fa-lg"
                  style={{ color: theme === 'dark' ? '#1877F3' : '#4267B2' }}
                />
              </a>
            )}
            {socialMedia.github && (
              <a href={socialMedia.github} target="_blank" rel="noopener" aria-label="GitHub" className="mx-2">
                <i
                  className="fab fa-github fa-lg"
                  style={{ color: theme === 'dark' ? '#f5f5f5' : '#24292F' }}
                />
              </a>
            )}
          </div>
        </div>
      </Container>
    </footer>
  );
}
