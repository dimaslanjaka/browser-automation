import fs from 'fs';
import path from 'path';

export class SharedPrefs {
  #filePath;
  #prefs;

  /**
   * @param {string} name - Preference file name (without extension)
   * @param {string} [dir='.cache/shared_prefs'] - Directory to store preferences
   */
  constructor(name, dir = '.cache/shared_prefs') {
    const folderPath = path.resolve(dir);
    this.#filePath = path.join(folderPath, `${name}.json`);

    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }

    this.#prefs = this.#load();
  }

  /**
   * Load preferences from disk
   * @returns {Record<string, any>}
   */
  #load() {
    if (!fs.existsSync(this.#filePath)) {
      fs.writeFileSync(this.#filePath, '{}');
      return {};
    }

    const content = fs.readFileSync(this.#filePath, 'utf-8');
    try {
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  /**
   * Save preferences to disk
   */
  #save() {
    fs.writeFileSync(this.#filePath, JSON.stringify(this.#prefs, null, 2));
  }

  /**
   * Get a value by key
   * @param {string} key
   * @param {any} [defaultValue=null]
   * @returns {any}
   */
  get(key, defaultValue = null) {
    return Object.hasOwn(this.#prefs, key) ? this.#prefs[key] : defaultValue;
  }

  /**
   * Set a key-value pair and auto-save
   * @param {string} key
   * @param {any} value
   */
  set(key, value) {
    this.#prefs[key] = value;
    this.#save();
  }

  /**
   * Remove a key and auto-save
   * @param {string} key
   */
  remove(key) {
    delete this.#prefs[key];
    this.#save();
  }

  /**
   * Check if a key exists
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return Object.hasOwn(this.#prefs, key);
  }

  /**
   * Get all key-value pairs
   * @returns {Record<string, any>}
   */
  getAll() {
    return { ...this.#prefs };
  }

  /**
   * Clear all preferences and auto-save
   */
  clear() {
    this.#prefs = {};
    this.#save();
  }
}
