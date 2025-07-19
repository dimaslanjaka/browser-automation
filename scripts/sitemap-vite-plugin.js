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

// Helper to check if a URL is an asset (has a file extension, but not .html)
function isAssetRequest(url) {
  // Ignore query/hash
  const cleanUrl = url.split(/[?#]/)[0];
  if (/@(vite|react)/i.test(cleanUrl)) return true; // Ignore Vite/React internal requests
  // Ignore .html (we want to collect those)
  return /\.[a-zA-Z0-9]+$/.test(cleanUrl) && !cleanUrl.endsWith('.html');
}

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

  // Set to collect visited non-asset URLs during dev
  const visitedUrls = new Set();

  return {
    name: 'vite-plugin-sitemap',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const isSitemap = req.url && (req.url.endsWith('/sitemap.txt') || req.url.endsWith('/sitemap.xml'));
        const isAsset = isAssetRequest(req.url);
        // Record non-asset, non-sitemap requests
        if (!isAsset && !isSitemap) {
          // Normalize: remove trailing slash except for root
          let url = req.url.replace(/[?#].*$/, '');
          if (url.length > 1 && url.endsWith('/')) url = url.slice(0, -1);
          // Add full URL
          visitedUrls.add(baseUrl.replace(/\/$/, '') + url);
        }
        if (!isAsset || isSitemap) {
          console.log(`Visited URL: ${req.url}`);
          console.log(`Visited URL count : ${visitedUrls.size}`);
        }

        if (isSitemap) {
          const absOutDir = path.resolve(process.cwd(), outDir);
          const fileUrls = getAllHtmlFiles(absOutDir, baseUrl, absOutDir, excludePatterns);
          // Combine and dedupe
          const urls = Array.from(new Set([...fileUrls, ...visitedUrls]));
          console.log(`Combined URLs for sitemap:`, urls);
          if (req.url && req.url.endsWith('sitemap.txt')) {
            res.setHeader('Content-Type', 'text/plain');
            res.end(generateSitemapTxt(urls));
            return;
          }
          if (req.url && req.url.endsWith('sitemap.xml')) {
            res.setHeader('Content-Type', 'application/xml');
            res.end(generateSitemapXml(urls));
            return;
          }
        }
        next();
      });
    },
    closeBundle() {
      const absOutDir = path.resolve(process.cwd(), outDir);
      const fileUrls = getAllHtmlFiles(absOutDir, baseUrl, absOutDir, excludePatterns);
      // Only file URLs are written at build time
      const sitemapTxt = generateSitemapTxt(fileUrls);
      const sitemapXml = generateSitemapXml(fileUrls);
      fs.writeFileSync(path.join(absOutDir, 'sitemap.txt'), sitemapTxt, 'utf8');
      fs.writeFileSync(path.join(absOutDir, 'sitemap.xml'), sitemapXml, 'utf8');
      console.log(`Sitemap generated: ${fileUrls.length} URLs`);
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
