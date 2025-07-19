import fs from 'fs';
import { minimatch } from 'minimatch';
import path from 'path';

/**
 * Recursively find all HTML files in a directory and return their URLs, with optional exclude patterns (minimatch supported).
 * @param {string} dir - Directory to search.
 * @param {string} baseUrl - Base URL for sitemap entries.
 * @param {string} baseDir - Root directory for relative paths.
 * @param {string[]} [excludePatterns] - Array of minimatch patterns to exclude.
 * @returns {string[]} Array of full URLs for each HTML file.
 */
function getAllHtmlFiles(dir, baseUrl, baseDir, excludePatterns = []) {
  const results = [];
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return results;
  for (const file of fs.readdirSync(dir)) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      results.push(...getAllHtmlFiles(filePath, baseUrl, baseDir, excludePatterns));
      continue;
    }
    if (!file.endsWith('.html')) continue;
    const relPath = path.relative(baseDir, filePath).replace(/\\/g, '/');
    const relPathForMatch = relPath.replace(/^\/+/, '');
    const fileName = path.basename(relPathForMatch);
    if (
      (excludePatterns || []).some(
        (pat) =>
          minimatch(relPath, pat, { dot: true }) ||
          minimatch('./' + relPath, pat, { dot: true }) ||
          minimatch(relPathForMatch, pat, { dot: true }) ||
          minimatch('./' + relPathForMatch, pat, { dot: true }) ||
          minimatch(fileName, pat, { dot: true })
      )
    )
      continue;
    results.push(relPath === 'index.html' ? baseUrl + '/' : baseUrl + '/' + relPath.replace(/index\.html$/, ''));
  }
  return results;
}

/**
 * Generate sitemap.txt content from an array of URLs.
 * @param {string[]} urls - List of URLs.
 * @returns {string} Sitemap.txt content.
 */
const generateSitemapTxt = (urls) => urls.join('\n') + '\n';

/**
 * Generate sitemap.xml content from an array of URLs.
 * @param {string[]} urls - List of URLs.
 * @returns {string} Sitemap.xml content.
 */
const generateSitemapXml = (urls) =>
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  urls.map((url) => `  <url>\n    <loc>${url}</loc>\n  </url>`).join('\n') +
  '\n</urlset>\n';

/**
 * Vite plugin to generate and serve sitemap.txt and sitemap.xml.
 * @param {object} options - Plugin options.
 * @param {string} [options.baseUrl] - Base URL for sitemap entries.
 * @param {string} [options.outDir] - Output directory for build files.
 * @returns {import('vite').Plugin} Vite plugin object.
 */
export default function SitemapVitePlugin(options = {}) {
  // Use both patterns by default for robust exclusion of 404.html in any directory
  const defaultExclude = ['404.html', '**/404.html'];
  const { baseUrl = 'https://example.com', outDir = 'dist', exclude } = options;
  const excludePatterns = Array.isArray(exclude) ? exclude : defaultExclude;

  return {
    name: 'vite-plugin-sitemap',
    apply: 'build',
    closeBundle() {
      const absOutDir = path.resolve(process.cwd(), outDir);
      const urls = getAllHtmlFiles(absOutDir, baseUrl, absOutDir, excludePatterns);
      const sitemapTxt = generateSitemapTxt(urls);
      const sitemapXml = generateSitemapXml(urls);
      fs.writeFileSync(path.join(absOutDir, 'sitemap.txt'), sitemapTxt, 'utf8');
      fs.writeFileSync(path.join(absOutDir, 'sitemap.xml'), sitemapXml, 'utf8');
      console.log(`Sitemap generated: ${urls.length} URLs`);
    },
    transformIndexHtml() {
      return [
        {
          tag: 'link',
          injectTo: 'head',
          attrs: {
            rel: 'sitemap',
            type: 'application/xml',
            title: 'Sitemap',
            href: '/sitemap.xml'
          }
        }
      ];
    }
  };
}
