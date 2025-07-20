import { useEffect } from 'react';
import { Container, Nav, Navbar } from 'react-bootstrap';
import { useTheme } from './ThemeContext.jsx';
import siteInfo from './site-information.json' with { type: 'json' };
import socialMedia from './social-media.json' with { type: 'json' };

export default function Header() {
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    document.body.classList.remove('bg-light', 'bg-dark', 'text-light', 'text-dark');
    if (theme === 'dark') {
      document.body.classList.add('bg-dark', 'text-light');
    } else {
      document.body.classList.add('bg-light', 'text-dark');
    }
  }, [theme]);

  return (
    <Navbar
      className={
        `mb-2 border-bottom bg-body-tertiary text-body py-2 py-md-3` +
        (theme === 'dark' ? ' border-dark' : ' border-light')
      }
      variant={theme === 'dark' ? 'dark' : 'light'}
      expand="lg"
      style={{ minHeight: 'unset' }}>
      <Container fluid className="px-2 px-md-4">
        <Navbar.Brand href={import.meta.env.BASE_URL} className="me-2" style={{ fontSize: '1.1rem', padding: 0 }}>
          {siteInfo.title}
        </Navbar.Brand>
        <Nav className="ms-auto d-flex flex-row align-items-center gap-2 gap-md-3" style={{ flexWrap: 'nowrap' }}>
          <div className="form-check form-switch d-flex align-items-center p-0 m-0" style={{ minHeight: 0 }}>
            <input
              className="form-check-input"
              type="checkbox"
              id="themeSwitch"
              checked={theme === 'dark'}
              onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')}
              style={{ cursor: 'pointer', width: '2em', height: '1.1em', minHeight: 0 }}
              aria-label="Switch theme"
            />
            <label
              htmlFor="themeSwitch"
              className="form-check-label ms-1"
              style={{ cursor: 'pointer', fontSize: '1.1em', minHeight: 0 }}>
              <i className={`fa fa-${theme === 'light' ? 'moon' : 'sun'}`} style={{ fontSize: '1.1em' }} />
            </label>
          </div>
          {socialMedia.facebook && (
            <Nav.Link
              href={socialMedia.facebook}
              target="_blank"
              rel="noopener"
              aria-label="Facebook"
              className="p-0 d-flex align-items-center"
              style={{ lineHeight: 1 }}>
              <i
                className="fab fa-facebook"
                style={{ color: theme === 'dark' ? '#1877F3' : '#4267B2', fontSize: '1.25em' }}
              />
            </Nav.Link>
          )}
          {socialMedia.github && (
            <Nav.Link
              href={socialMedia.github}
              target="_blank"
              rel="noopener"
              aria-label="GitHub"
              className="p-0 d-flex align-items-center"
              style={{ lineHeight: 1 }}>
              <i
                className="fab fa-github"
                style={{ color: theme === 'dark' ? '#f5f5f5' : '#24292F', fontSize: '1.25em' }}
              />
            </Nav.Link>
          )}
        </Nav>
      </Container>
    </Navbar>
  );
}
