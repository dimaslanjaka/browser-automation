import { useEffect } from 'react';
import { Container, Nav, Navbar } from 'react-bootstrap';
import { useTheme } from './ThemeContext.jsx';
import socialMedia from './social-media.json';

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
      style={{ backgroundColor: theme === 'dark' ? '#23272f' : '#f8f9fa' }}
      variant={theme === 'dark' ? 'dark' : 'light'}
      expand="lg"
      className="mb-4 border-bottom"
    >
      <Container>
        <Navbar.Brand href="/browser-automation">My App Header</Navbar.Brand>
        <Nav className="ms-auto align-items-center">
          <div className="form-check form-switch me-3 d-flex align-items-center">
            <input
              className="form-check-input"
              type="checkbox"
              id="themeSwitch"
              checked={theme === 'dark'}
              onChange={(e) => setTheme(e.target.checked ? 'dark' : 'light')}
              style={{ cursor: 'pointer', width: '2.5em', height: '1.5em' }}
              aria-label="Switch theme"
            />
            <label htmlFor="themeSwitch" className="form-check-label ms-2" style={{ cursor: 'pointer' }}>
              <i className={`fa fa-${theme === 'light' ? 'moon' : 'sun'} fa-lg`} />
            </label>
          </div>
          {socialMedia.facebook && (
            <Nav.Link href={socialMedia.facebook} target="_blank" rel="noopener" aria-label="Facebook">
              <i
                className="fab fa-facebook fa-lg"
                style={{ color: theme === 'dark' ? '#1877F3' : '#4267B2' }}
              />
            </Nav.Link>
          )}
          {socialMedia.github && (
            <Nav.Link href={socialMedia.github} target="_blank" rel="noopener" aria-label="GitHub">
              <i
                className="fab fa-github fa-lg"
                style={{ color: theme === 'dark' ? '#f5f5f5' : '#24292F' }}
              />
            </Nav.Link>
          )}
        </Nav>
      </Container>
    </Navbar>
  );
}
