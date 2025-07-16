import { createContext, useContext, useState } from 'react';

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
  const [theme, setTheme] = useState('light');
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

/**
 * useTheme hook to access theme context value.
 * @returns {ThemeContextValue}
 */
export function useTheme() {
  return useContext(ThemeContext);
}
