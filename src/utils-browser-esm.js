/**
 * Get the Vite base URL and join with provided path segments.
 * Usage: getBaseUrl('foo', 'bar') => '/base/foo/bar'
 * Handles leading/trailing slashes and empty segments.
 * @param {...string} segments - Path segments to join to the base URL.
 * @returns {string} The full URL with base and joined path.
 */
export function getViteUrl(...segments) {
  // Vite's base URL, fallback to '/' if not defined
  let base = '/';
  // Only works in ESM/browser context, not in Node.js CJS
  if (typeof window !== 'undefined' && import.meta.env.BASE_URL) {
    base = import.meta.env.BASE_URL;
  }
  // Clean up and join segments
  const joined = segments
    .filter(Boolean)
    .map((s) => s.replace(/^\/+|\/+$/g, ''))
    .join('/');
  // Ensure base ends with a single slash
  const baseClean = base.replace(/\/+$/, '');
  return baseClean + (joined ? '/' + joined : '');
}
