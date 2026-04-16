import fs from 'fs-extra';
import path from 'path';

class Cookies {
  constructor(id = 'default', profileDir = path.resolve(process.cwd(), 'profiles')) {
    this.id = id;
    this.profileDir = profileDir;
  }

  getFilePath() {
    // If id is an absolute path, use it directly (with or without .json extension)
    if (path.isAbsolute(this.id)) {
      if (this.id.endsWith('.json')) {
        return this.id;
      }
      return `${this.id}_cookies.json`;
    }
    return path.join(this.profileDir, `${this.id}_cookies.json`);
  }

  /**
   * Load cookies into Puppeteer page
   * @param {import('puppeteer').Page} page
   * @param {object} options
   * @returns {Promise<boolean>}
   */
  async load(page, options = {}) {
    const { ignoreErrors = true } = options;

    const filePath = this.getFilePath();

    if (!(await fs.pathExists(filePath))) {
      return false;
    }

    try {
      const cookies = await fs.readJSON(filePath);

      if (!Array.isArray(cookies) || cookies.length === 0) {
        return false;
      }

      await page.setCookie(...cookies);
      return true;
    } catch (err) {
      if (!ignoreErrors) throw err;
      console.warn(`Failed to load cookies (${filePath}):`, err.message);
      return false;
    }
  }

  /**
   * Save cookies from Puppeteer page
   * @param {import('puppeteer').Page} page
   * @param {object} options
   * @returns {Promise<string>} file path
   */
  async save(page, options = {}) {
    const { filter = null, spaces = 2 } = options;

    const filePath = this.getFilePath();

    await fs.ensureDir(this.profileDir);

    let cookies = await page.cookies();

    if (typeof filter === 'function') {
      cookies = cookies.filter(filter);
    }

    await fs.writeJSON(filePath, cookies, { spaces });

    return filePath;
  }

  /**
   * Clear cookies file
   * @returns {Promise<boolean>}
   */
  async clear() {
    const filePath = this.getFilePath();

    if (await fs.pathExists(filePath)) {
      await fs.remove(filePath);
      return true;
    }

    return false;
  }

  /**
   * Read cookies data from file (no page interaction)
   * @returns {Promise<Array|false>} cookies array or false if not found/invalid
   */
  async read() {
    const filePath = this.getFilePath();
    if (!(await fs.pathExists(filePath))) {
      return false;
    }
    try {
      const cookies = await fs.readJSON(filePath);
      if (!Array.isArray(cookies) || cookies.length === 0) {
        return false;
      }
      return cookies;
    } catch (err) {
      console.warn(`Failed to read cookies (${filePath}):`, err.message);
      return false;
    }
  }
}

export default Cookies;
export { Cookies as PuppeteerCookies };
