import fs from 'fs';
import path from 'path';
import { logLine } from '../src/utils.js';
import * as cheerio from 'cheerio';
import postList from '../src/react-website/components/post-lists.json';

const distDir = path.join(process.cwd(), 'dist');

/**
 * Vite plugin to copy and update HTML files after build, including SEO and meta tags.
 *
 * @typedef {Object} HtmlOption
 * @property {string} dest Destination path for the HTML file.
 * @property {string} title Title for the HTML page.
 * @property {string} canonical Canonical URL for SEO.
 * @property {string} [thumbnail] Thumbnail image URL for meta tags.
 * @property {string} [author] Author name for meta tags.
 * @property {string} [description] Description for meta tags.
 * @property {string} [icon] Icon image URL for favicon (optional).
 *
 * @returns {import('vite').Plugin} Vite plugin object for after-build HTML processing.
 */
function AfterBuildCopyPlugin() {
  let isBuild = false;
  return {
    name: 'after-build-copy-index',
    apply: 'build',
    configResolved(config) {
      isBuild = config.command === 'build';
    },
    closeBundle() {
      if (!isBuild) return;
      const src = path.join(distDir, 'index.html');
      /** @type {HtmlOption[]} */
      const options = [
        {
          dest: path.join(distDir, 'index.html'),
          title: 'Home - React App',
          canonical: 'https://www.webmanajemen.com/browser-automation/'
        }
      ];
      postList.forEach((post) => {
        const option = {};
        for (const key in post) {
          if (key === 'dest') {
            option.dest = path.join(distDir, post[key]);
          } else if (key === 'href') {
            option.canonical = `https://www.webmanajemen.com/browser-automation/${post[key]}`;
          } else if (key === 'thumbnail' || key === 'image') {
            option.thumbnail = post[key];
          } else {
            option[key] = post[key];
          }
        }
        options.push(option);
      });
      for (const option of options) {
        const { dest, title, canonical, thumbnail = '', author = '', description = '', icon = '' } = option;
        if (!fs.existsSync(path.dirname(dest))) {
          fs.mkdirSync(path.dirname(dest), { recursive: true });
        }
        fs.copyFileSync(src, dest);
        logLine(`Copied ${src} to ${dest}`);

        // Update HTML metadata
        const htmlContent = fs.readFileSync(dest, 'utf-8');
        const $ = cheerio.load(htmlContent);

        // --- SEO META TAGS ---
        if (icon.length > 0) {
          // Update favicon:
          $('link[rel="icon"]').attr('href', icon);
          // Update Apple touch icon:
          $('link[rel="apple-touch-icon"]').attr('href', icon);
        }
        // Update title:
        $('title').text(title);
        // Update Open Graph title:
        $('meta[property="og:title"]').attr('content', title);
        // Update Twitter title:
        $('meta[name="twitter:title"]').attr('content', title);
        // Update canonical URL:
        $('link[rel="canonical"]').attr('href', canonical);
        // Update author:
        if (author.length > 0) $('meta[name="author"]').attr('content', author);
        // Update keywords (optional):
        // $('meta[name="keywords"]').attr('content', 'keyword1, keyword2, ...');
        // Update robots (optional):
        // $('meta[name="robots"]').attr('content', 'index, follow');
        // Update Open Graph type:
        $('meta[property="og:type"]').attr('content', 'website');
        // Update Twitter card type:
        $('meta[name="twitter:card"]').attr('content', 'summary_large_image');
        // Update locale/language (optional):
        // $('meta[property="og:locale"]').attr('content', 'en_US');
        // Update site name (Open Graph, optional):
        // $('meta[property="og:site_name"]').attr('content', 'Your Site Name');
        if (thumbnail.length > 0) {
          // Update Open Graph image:
          $('meta[property="og:image"]').attr('content', thumbnail);
          // Update Twitter image:
          $('meta[name="twitter:image"]').attr('content', thumbnail);
          // Update generic image meta (for some crawlers):
          $('meta[name="image"]').attr('content', thumbnail);
          // Update itemprop image (for Google rich snippets):
          $('meta[itemprop="image"]').attr('content', thumbnail);
        }
        // Update meta description:
        if (description.length > 0) $('meta[name="description"]').attr('content', description);
        // Update Open Graph description:
        if (description.length > 0) $('meta[property="og:description"]').attr('content', description);
        // Update Twitter description:
        if (description.length > 0) $('meta[name="twitter:description"]').attr('content', description);
        // Add more meta tags as needed for SEO...
        const updatedHtml = $.html();
        fs.writeFileSync(dest, updatedHtml, 'utf-8');
        logLine(`Updated html in ${dest}`);
      }
    }
  };
}

export default AfterBuildCopyPlugin;
