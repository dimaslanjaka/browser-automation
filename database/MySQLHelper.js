import '../chunk-BUSYA2B4.js';
import mariadb from 'mariadb';
import fs from 'fs-extra';
import path from 'path';

class MySQLHelper {
  pool;
  config;
  ready = false;
  constructor(config) {
    this.config = config;
  }
  async initialize() {
    if (this.ready) return;
    const _schemaIndicatorFile = path.join(process.cwd(), "tmp/database/", `${this.config.database}.schema`);
    if (!fs.existsSync(_schemaIndicatorFile)) {
      await this._ensureDatabase();
      await fs.ensureDir(path.dirname(_schemaIndicatorFile));
      await fs.writeFile(_schemaIndicatorFile, `Initialized at ${(/* @__PURE__ */ new Date()).toISOString()}
`, "utf-8");
    }
    this.pool = mariadb.createPool({
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
    const adminConn = await mariadb.createConnection({
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

export { MySQLHelper, MySQLHelper_default as default };
//# sourceMappingURL=MySQLHelper.js.map
//# sourceMappingURL=MySQLHelper.js.map