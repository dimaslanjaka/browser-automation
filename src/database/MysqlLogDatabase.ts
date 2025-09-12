import { BaseLogDatabase, LogEntry } from './BaseLogDatabase.js';
import createDatabasePool from './mysql.js';

/**
 * Utility to get current timestamp in Asia/Jakarta in ISO8601 format.
 */
function getJakartaTimestamp() {
  // Asia/Jakarta is UTC+7
  const date = new Date();
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const jakarta = new Date(utc + 7 * 60 * 60000);
  return jakarta.toISOString().replace('Z', '+07:00');
}

export const defaultOptions: Partial<Parameters<typeof createDatabasePool>[0]> = {
  connectTimeout: 60000 // default 60s
};

/**
 * Options for adding a log entry.
 *
 * @property timeout Optional timeout in milliseconds for the database operation.
 * @property update Optional flag to update an existing log entry if it exists.
 */
export interface AddLogOptions {
  /**
   * Timeout in milliseconds for the database operation. (default: 60000)
   */
  timeout?: number;
  /**
   * Whether to update an existing log entry if it exists. (default: true)
   */
  update?: boolean;
}

/**
 * Class representing a log database using MySQL.
 */
export class MysqlLogDatabase implements BaseLogDatabase {
  private poolPromise: Promise<import('mariadb').Pool>;
  private readyPromise: Promise<void>;

  /**
   * Create a new MysqlLogDatabase instance.
   *
   * @param dbName Optional database name (not used, for compatibility)
   * @param options Optional pool options (e.g., connectTimeout)
   */
  constructor(dbName?: string, options: Partial<Parameters<typeof createDatabasePool>[0]> = {}) {
    const poolOptions = dbName ? { database: dbName, ...options } : { ...options };
    // filter out 'type' property if present
    if ('type' in poolOptions) {
      delete (poolOptions as any).type;
    }
    const mergedOptions = Object.assign({}, defaultOptions, poolOptions);
    this.poolPromise = createDatabasePool(mergedOptions);
    this.readyPromise = this._initializeDatabase();
  }

  /**
   * Initialize the database: create logs table if not exists.
   *
   * @private
   * @returns Promise that resolves when initialization is complete.
   */
  private async _initializeDatabase() {
    const pool = await this.poolPromise;
    await pool.query(`CREATE TABLE IF NOT EXISTS logs (
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
  public async query(sql: string, params?: any[]): Promise<any> {
    await this.readyPromise;
    const pool = await this.poolPromise;
    return pool.query(sql, params);
  }

  /**
   * Add or update a log entry in the database.
   *
   * @param log Log entry object.
   * @param options Optional query options (e.g., timeout in ms)
   * @returns Promise that resolves when the log is added or updated.
   */
  async addLog<T = any>({ id, data, message, timestamp = undefined }: LogEntry<T>, options: AddLogOptions = {}) {
    await this.readyPromise;
    const pool = await this.poolPromise;
    if (!timestamp) timestamp = getJakartaTimestamp();
    const defaultOptions = {
      timeout: 60000, // default 60s if not provided
      update: true // always update by default
    };
    options = { ...defaultOptions, ...options };
    if (options.update) {
      // If updating, first get the existing log
      const existing = await this.getLogById(id);
      if (existing) {
        // If existing log is found, merge data
        if (typeof data === 'object' && typeof existing.data === 'object') {
          data = { ...existing.data, ...data };
        }
      }
    }
    // mariadb does not support object with sql/timeout, so use query options directly
    await pool.query(`REPLACE INTO logs (id, data, message, timestamp) VALUES (?, ?, ?, ?)`, [
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
  async removeLog(id: LogEntry<any>['id']): Promise<boolean> {
    await this.readyPromise;
    const pool = await this.poolPromise;
    const result: any = await pool.query('DELETE FROM logs WHERE id = ?', [id]);
    // mariadb returns an object with affectedRows
    return result.affectedRows > 0;
  }

  /**
   * Get a log entry by its id.
   *
   * @param id Unique log identifier.
   * @returns Promise that resolves to the log object or undefined if not found.
   */
  async getLogById<T = any>(id: LogEntry<T>['id']): Promise<LogEntry<T> | undefined> {
    await this.readyPromise;
    const pool = await this.poolPromise;
    const rows: any = await pool.query('SELECT * FROM logs WHERE id = ?', [id]);
    if (!rows[0]) return undefined;
    return {
      id: rows[0].id,
      data: JSON.parse(rows[0].data) as T,
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
  async getLogs<T = any>(
    filterFn?: (log: LogEntry<T>) => boolean | Promise<boolean>,
    options?: { limit?: number; offset?: number }
  ) {
    await this.readyPromise;
    const pool = await this.poolPromise;
    let query = 'SELECT * FROM logs';
    const params: any[] = [];
    if (options?.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
      if (options.offset) {
        query += ' OFFSET ?';
        params.push(options.offset);
      }
    }
    const rows: any = await pool.query(query, params);
    const logsArr: LogEntry<T>[] = rows.map((row: any) => ({
      id: row.id,
      data: JSON.parse(row.data),
      message: row.message,
      timestamp: row.timestamp
    }));
    if (!filterFn) return logsArr;
    // Support async filterFn
    const results = await Promise.all(logsArr.map(async (log) => ((await filterFn(log)) ? log : undefined)));
    return results.filter(Boolean);
  }

  /**
   * Wait until the database is ready for operations.
   *
   * @returns Promise that resolves when the database is ready.
   */
  public async waitReady() {
    return await this.readyPromise;
  }

  private closed = false;

  public isClosed(): boolean {
    return this.closed;
  }

  /**
   * Close the database connection pool.
   *
   * @returns Promise that resolves when the pool is closed.
   */
  async close() {
    if (this.closed) return;
    await this.readyPromise;
    const pool = await this.poolPromise;
    await pool.end();
    this.closed = true;
  }
}
