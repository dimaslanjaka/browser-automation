import { createContext, useContext, useState, useEffect } from 'react';

/**
 * ThemeContext provides global theme state and setter.
 * @typedef {{ theme: string, setTheme: function(string): void }} ThemeContextValue
 *
 * @type {import('react').Context<ThemeContextValue>}
 */
const ThemeContext = createContext({
  theme: 'light',
  setTheme: (_theme) => {}
});

/**
 * ThemeProvider wraps the app and provides theme state.
 * @param {{ children: import('react').ReactNode }} props
 */
export function ThemeProvider({ children }) {
  // Load theme from localStorage or default to 'light'
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  // Update state and localStorage
  const setTheme = (newTheme) => {
    setThemeState(newTheme);
    localStorage.setItem('theme', newTheme);
  };

  // Set data-bs-theme on body when theme changes
  useEffect(() => {
    document.body.setAttribute('data-bs-theme', theme);
  }, [theme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

/**
 * useTheme hook to access theme context value.
 * @returns {ThemeContextValue}
 */
export function useTheme() {
  return useContext(ThemeContext);
}
