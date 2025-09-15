'use strict';

require('./chunk-4IBVXDKH.cjs');
var fs = require('fs');
var path = require('path');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var fs__default = /*#__PURE__*/_interopDefault(fs);
var path__default = /*#__PURE__*/_interopDefault(path);

const instances = /* @__PURE__ */ new Set();
function registerShutdownHook() {
  const saveAll = () => {
    for (const instance of instances) {
      instance.saveToDisk();
    }
  };
  process.once("exit", saveAll);
  process.once("SIGINT", () => {
    saveAll();
    process.exit(0);
  });
  process.once("SIGTERM", () => {
    saveAll();
    process.exit(0);
  });
}
let shutdownHookRegistered = false;
class SharedPrefs {
  /** @type {string} */
  #filePath;
  /** @type {Record<string, any>} */
  #prefs;
  /** @type {boolean} */
  #dirty = false;
  /**
   * @param {string} name - Preference file name (without extension)
   * @param {string} [dir='.cache/shared_prefs'] - Directory to store preference files
   */
  constructor(name, dir = ".cache/shared_prefs") {
    const folderPath = path__default.default.resolve(dir);
    this.#filePath = path__default.default.join(folderPath, `${name}.json`);
    if (!fs__default.default.existsSync(folderPath)) {
      fs__default.default.mkdirSync(folderPath, { recursive: true });
    }
    this.#prefs = this.#load();
    instances.add(this);
    if (!shutdownHookRegistered) {
      registerShutdownHook();
      shutdownHookRegistered = true;
    }
  }
  /**
   * Load preference data from disk.
   * @returns {Record<string, any>}
   * @private
   */
  #load() {
    if (!fs__default.default.existsSync(this.#filePath)) {
      return {};
    }
    try {
      return JSON.parse(fs__default.default.readFileSync(this.#filePath, "utf-8"));
    } catch {
      return {};
    }
  }
  /**
   * Save the current preferences to disk if they have changed.
   */
  saveToDisk() {
    if (this.#dirty) {
      fs__default.default.writeFileSync(this.#filePath, JSON.stringify(this.#prefs, null, 2));
      this.#dirty = false;
    }
  }
  /**
   * Get a stored value by key.
   * @param {string} key
   * @param {any} [defaultValue=null]
   * @returns {any}
   */
  get(key, defaultValue = null) {
    return Object.hasOwn(this.#prefs, key) ? this.#prefs[key] : defaultValue;
  }
  /**
   * Set a value for a key (writes will be deferred until process exit).
   * @param {string} key
   * @param {any} value
   */
  set(key, value) {
    this.#prefs[key] = value;
    this.#dirty = true;
  }
  /**
   * Remove a key from the preferences.
   * @param {string} key
   */
  remove(key) {
    delete this.#prefs[key];
    this.#dirty = true;
  }
  /**
   * Check if a key exists.
   * @param {string} key
   * @returns {boolean}
   */
  has(key) {
    return Object.hasOwn(this.#prefs, key);
  }
  /**
   * Get all key-value pairs.
   * @returns {Record<string, any>}
   */
  getAll() {
    return { ...this.#prefs };
  }
  /**
   * Clear all preferences.
   */
  clear() {
    this.#prefs = {};
    this.#dirty = true;
  }
}

exports.SharedPrefs = SharedPrefs;
//# sourceMappingURL=SharedPrefs.cjs.map
//# sourceMappingURL=SharedPrefs.cjs.map