'use strict';

require('../chunk-4IBVXDKH.cjs');
var sbgUtility = require('sbg-utility');
var fs = require('fs-extra');
var path = require('upath');
var MysqlLogDatabase_js = require('./MysqlLogDatabase.js');
var SQLiteLogDatabase_js = require('./SQLiteLogDatabase.js');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var fs__default = /*#__PURE__*/_interopDefault(fs);
var path__default = /*#__PURE__*/_interopDefault(path);

class LogDatabase {
  options;
  dbName;
  store;
  pref;
  sqliteDbPath;
  constructor(dbName, options) {
    this.options = options;
    this.dbName = dbName || "default";
    this.pref = new sbgUtility.SharedPreferences({ namespace: this.constructor.name });
    this.sqliteDbPath = SQLiteLogDatabase_js.getDatabaseFilePath(this.dbName);
  }
  async getType() {
    if (!this.store) await this.initialize();
    const optionsType = this.options.type || "sqlite";
    return { optionsType, classType: this.store instanceof MysqlLogDatabase_js.MysqlLogDatabase ? "mysql" : "sqlite" };
  }
  async addLog(log, options) {
    if (!this.store) await this.initialize();
    return await this.store.addLog(log, options);
  }
  async removeLog(id) {
    if (!this.store) await this.initialize();
    return await this.store.removeLog(id);
  }
  async getLogById(id) {
    if (!this.store) await this.initialize();
    return await this.store.getLogById(id);
  }
  async getLogs(filterFn, options) {
    if (!this.store) await this.initialize();
    return await this.store.getLogs(filterFn, options);
  }
  async waitReady() {
    if (!this.store) await this.initialize();
    if (this.store instanceof MysqlLogDatabase_js.MysqlLogDatabase) {
      return await this.store.waitReady();
    }
    return;
  }
  async query(sql, params) {
    if (!this.store) await this.initialize();
    return await this.store.query(sql, params);
  }
  async close() {
    if (!this.store) return;
    if (this.store instanceof SQLiteLogDatabase_js.SQLiteLogDatabase || this.pref.getBoolean("needsMigration", false)) {
      try {
        await this.migrate();
      } catch (e) {
        console.error("Migration error:", e);
        this.pref.putBoolean("needsMigration", true);
      }
    }
    await this.store.close();
    this.store = void 0;
  }
  /**
   * Returns true if the underlying database connection (MySQL/SQLite) is closed.
   */
  isClosed() {
    if (!this.store) return true;
    if (typeof this.store.isClosed === "function") {
      return this.store.isClosed();
    }
    return false;
  }
  async initialize() {
    var _a, _b;
    if (this.store) return;
    const safeOptions = { ...this.options };
    if (safeOptions.password) safeOptions.password = "***";
    if (safeOptions.user) safeOptions.user = "***";
    console.log(`[LogDatabase] Initializing LogDatabase with dbName='${this.dbName}' and options:`, safeOptions);
    if (((_a = this.options) == null ? void 0 : _a.type) === "sqlite") {
      this.store = new SQLiteLogDatabase_js.SQLiteLogDatabase(this.dbName);
    } else if (((_b = this.options) == null ? void 0 : _b.type) === "mysql") {
      this.store = new MysqlLogDatabase_js.MysqlLogDatabase(this.dbName, this.options);
    } else {
      try {
        this.store = new MysqlLogDatabase_js.MysqlLogDatabase(this.dbName, this.options);
      } catch (error) {
        console.error("Error initializing database:", error.message);
        console.error("Falling back to SQLite database.");
        this.store = new SQLiteLogDatabase_js.SQLiteLogDatabase(this.dbName);
      }
    }
  }
  async showProcessList(print = false) {
    var _a;
    if (!this.store) await this.initialize();
    if (this.store instanceof MysqlLogDatabase_js.MysqlLogDatabase) {
      const [rows] = await this.store.query("SHOW PROCESSLIST");
      if (print) {
        const e = new Error();
        console.log("Called from:", (_a = e.stack) == null ? void 0 : _a.split("\n")[3].trim());
        console.log("Process List:", rows);
      }
      return rows;
    }
    if (print) console.log("showProcessList is only available for MySQL databases");
  }
  /**
   * Check if the checksum of the SQLite database file has changed since the last recorded value.
   *
   * Compares the current checksum of the SQLite database file with the last stored checksum
   * in the `.cache/migrations/` directory. If `save` is true and the checksum has changed,
   * updates the stored checksum file.
   *
   * @param save Whether to update the stored checksum file if the checksum has changed.
   * @returns True if the checksum has changed, false otherwise.
   */
  isChecksumChanged(save = false) {
    const sqliteFile = SQLiteLogDatabase_js.getDatabaseFilePath(this.dbName);
    const sqliteChecksum = sbgUtility.getChecksum(sqliteFile);
    const checksumFile = path__default.default.join(process.cwd(), `.cache/migrations/${this.dbName || "logs"}.checksum`);
    const lastChecksum = fs__default.default.existsSync(checksumFile) ? fs__default.default.readFileSync(checksumFile, "utf-8") : null;
    if (save && lastChecksum !== sqliteChecksum) {
      fs__default.default.ensureDirSync(path__default.default.dirname(checksumFile));
      fs__default.default.writeFileSync(checksumFile, sqliteChecksum);
    }
    return lastChecksum !== sqliteChecksum;
  }
  /**
   * Migrates logs from the SQLite database to the MySQL database for the current database name.
   *
   * Skips logs that already exist in the MySQL database.
   * Uses a lock file in the `.cache/migrations/` directory, named by the checksum of the SQLite file,
   * to prevent duplicate migrations. If the lock file exists, migration is skipped.
   *
   * Only performs migration if the checksum of the SQLite database file has changed since the last migration.
   * After a successful migration, updates the stored checksum file.
   *
   * @returns Promise that resolves when migration is complete or skipped.
   */
  async migrate() {
    if (!this.isChecksumChanged()) {
      return;
    }
    const sqlite = new SQLiteLogDatabase_js.SQLiteLogDatabase(this.dbName);
    const mysql = new MysqlLogDatabase_js.MysqlLogDatabase(this.dbName);
    const logs = sqlite.getLogs();
    for await (const log of logs) {
      if (await mysql.getLogById(log.id)) {
        console.log(`Skipping existing log id=${log.id}`);
        continue;
      }
      await mysql.addLog(log);
      console.log(`Migrated log id=${log.id}`);
    }
    sqlite.close();
    await mysql.close();
    this.isChecksumChanged(true);
  }
}

exports.LogDatabase = LogDatabase;
//# sourceMappingURL=LogDatabase.cjs.map
//# sourceMappingURL=LogDatabase.cjs.map