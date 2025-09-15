'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

require('../chunk-4IBVXDKH.cjs');
var mariadb = require('mariadb');
var fs = require('fs-extra');
var path = require('path');

function _interopDefault (e) { return e && e.__esModule ? e : { default: e }; }

var mariadb__default = /*#__PURE__*/_interopDefault(mariadb);
var fs__default = /*#__PURE__*/_interopDefault(fs);
var path__default = /*#__PURE__*/_interopDefault(path);

class MySQLHelper {
  pool;
  config;
  ready = false;
  constructor(config) {
    this.config = config;
  }
  async initialize() {
    if (this.ready) return;
    const _schemaIndicatorFile = path__default.default.join(process.cwd(), "tmp/database/", `${this.config.database}.schema`);
    if (!fs__default.default.existsSync(_schemaIndicatorFile)) {
      await this._ensureDatabase();
      await fs__default.default.ensureDir(path__default.default.dirname(_schemaIndicatorFile));
      await fs__default.default.writeFile(_schemaIndicatorFile, `Initialized at ${(/* @__PURE__ */ new Date()).toISOString()}
`, "utf-8");
    }
    this.pool = mariadb__default.default.createPool({
      host: this.config.host,
      user: this.config.user,
      password: this.config.password,
      database: this.config.database,
      port: parseInt(String(this.config.port || 3306), 10),
      connectionLimit: this.config.connectionLimit || 5,
      connectTimeout: this.config.connectTimeout || 6e4,
      allowPublicKeyRetrieval: true
    });
    this.ready = true;
  }
  async _ensureDatabase() {
    const adminConn = await mariadb__default.default.createConnection({
      host: this.config.host,
      user: this.config.user,
      password: this.config.password,
      port: parseInt(String(this.config.port ?? "3306"), 10),
      connectTimeout: this.config.connectTimeout || 6e4,
      allowPublicKeyRetrieval: true
    });
    await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${this.config.database}\``);
    await adminConn.end();
  }
  /**
   * Execute a simple query
   */
  async query(sql, params = []) {
    let conn;
    try {
      conn = await this.pool.getConnection();
      const rows = await conn.query(sql, params);
      return Array.isArray(rows) ? rows : [];
    } finally {
      if (conn) conn.release();
    }
  }
  /**
   * Execute insert/update/delete
   */
  async execute(sql, params = []) {
    let conn;
    try {
      conn = await this.pool.getConnection();
      const result = await conn.query(sql, params);
      return {
        affectedRows: result.affectedRows || 0,
        insertId: result.insertId || void 0
      };
    } finally {
      if (conn) conn.release();
    }
  }
  /**
   * Transaction wrapper
   */
  async transaction(fn) {
    let conn;
    try {
      conn = await this.pool.getConnection();
      await conn.beginTransaction();
      const result = await fn(conn);
      await conn.commit();
      return result;
    } catch (err) {
      if (conn) await conn.rollback();
      throw err;
    } finally {
      if (conn) conn.release();
    }
  }
  /**
   * Close the pool
   */
  async close() {
    if (!this.ready) return;
    await this.pool.end();
    this.ready = false;
  }
}
var MySQLHelper_default = MySQLHelper;

exports.MySQLHelper = MySQLHelper;
exports.default = MySQLHelper_default;
//# sourceMappingURL=MySQLHelper.cjs.map
//# sourceMappingURL=MySQLHelper.cjs.map