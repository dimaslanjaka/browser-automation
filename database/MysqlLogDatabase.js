import '../chunk-BUSYA2B4.js';
import { MySQLHelper } from './MySQLHelper.js';

function getJakartaTimestamp() {
  const date = /* @__PURE__ */ new Date();
  const utc = date.getTime() + date.getTimezoneOffset() * 6e4;
  const jakarta = new Date(utc + 7 * 60 * 6e4);
  return jakarta.toISOString().replace("Z", "+07:00");
}
const defaultOptions = {
  connectTimeout: 6e4
  // default 60s
};
class MysqlLogDatabase {
  helper;
  config;
  /**
   * Create a new MysqlLogDatabase instance.
   *
   * @param dbName Optional database name (not used, for compatibility)
   * @param options Optional pool options (e.g., connectTimeout)
   */
  constructor(dbName, options = {}) {
    const poolOptions = dbName ? { database: dbName, ...options } : { ...options };
    if ("type" in poolOptions) {
      delete poolOptions.type;
    }
    const mergedOptions = Object.assign({}, defaultOptions, poolOptions);
    this.config = mergedOptions;
    this.helper = new MySQLHelper(mergedOptions);
  }
  async waitReady() {
    if (!this.helper.ready) {
      await this.helper.initialize();
    }
    await this.helper.query(`CREATE TABLE IF NOT EXISTS logs (
      id VARCHAR(255) PRIMARY KEY,
      data TEXT,
      message TEXT,
      timestamp VARCHAR(40)
    )`);
  }
  /**
   * Execute a raw SQL query on the underlying MySQL pool.
   *
   * @param sql The SQL query string.
   * @param params Optional parameters for the query.
   * @returns Promise resolving to the query result.
   */
  async query(sql, params) {
    return this.helper.query(sql, params);
  }
  /**
   * Add or update a log entry in the database.
   *
   * @param log Log entry object.
   * @param options Optional query options (e.g., timeout in ms)
   * @returns Promise that resolves when the log is added or updated.
   */
  async addLog({ id, data, message, timestamp = void 0 }, options = {}) {
    if (!timestamp) timestamp = getJakartaTimestamp();
    const defaultOptions2 = {
      timeout: 6e4,
      // default 60s if not provided
      update: true
      // always update by default
    };
    options = { ...defaultOptions2, ...options };
    if (options.update) {
      const existing = await this.getLogById(id);
      if (existing) {
        if (typeof data === "object" && typeof existing.data === "object") {
          data = { ...existing.data, ...data };
        }
      }
    }
    await this.helper.query(`REPLACE INTO logs (id, data, message, timestamp) VALUES (?, ?, ?, ?)`, [
      id,
      JSON.stringify(data),
      message,
      timestamp
    ]);
  }
  /**
   * Remove a log entry by its id.
   *
   * @param id Unique log identifier.
   * @returns Promise that resolves to true if a log was removed, false otherwise.
   */
  async removeLog(id) {
    const result = await this.helper.execute("DELETE FROM logs WHERE id = ?", [id]);
    return result.affectedRows > 0;
  }
  /**
   * Get a log entry by its id.
   *
   * @param id Unique log identifier.
   * @returns Promise that resolves to the log object or undefined if not found.
   */
  async getLogById(id) {
    const rows = await this.helper.query("SELECT * FROM logs WHERE id = ?", [id]);
    if (!rows[0]) return void 0;
    return {
      id: rows[0].id,
      data: JSON.parse(rows[0].data),
      message: rows[0].message,
      timestamp: rows[0].timestamp
    };
  }
  /**
   * Get all logs or filtered logs from the database.
   *
   * @param filterFn Optional filter function to apply to each log entry after fetching from the database. Can be async.
   * @param options Optional object with limit and offset for pagination.
   * @returns Promise that resolves to an array of log objects.
   */
  async getLogs(filterFn, options) {
    let query = "SELECT * FROM logs";
    const params = [];
    if (options == null ? void 0 : options.limit) {
      query += " LIMIT ?";
      params.push(options.limit);
      if (options.offset) {
        query += " OFFSET ?";
        params.push(options.offset);
      }
    }
    const rows = await this.helper.query(query, params);
    const logsArr = rows.map((row) => ({
      id: row.id,
      data: JSON.parse(row.data),
      message: row.message,
      timestamp: row.timestamp
    }));
    if (!filterFn) return logsArr;
    const results = await Promise.all(logsArr.map(async (log) => await filterFn(log) ? log : void 0));
    return results.filter(Boolean);
  }
  closed = false;
  isClosed() {
    return this.closed;
  }
  /**
   * Close the database connection pool.
   *
   * @returns Promise that resolves when the pool is closed.
   */
  async close() {
    if (this.closed) return;
    await this.helper.close();
    this.closed = true;
  }
}

export { MysqlLogDatabase, defaultOptions };
//# sourceMappingURL=MysqlLogDatabase.js.map
//# sourceMappingURL=MysqlLogDatabase.js.map