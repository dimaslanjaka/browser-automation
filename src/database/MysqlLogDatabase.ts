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

export interface LogEntry<T> {
  id: string | number;
  data: T;
  message: string;
  timestamp?: string;
}

/**
 * Class representing a log database using MySQL.
 */
export class MysqlLogDatabase {
  private poolPromise: Promise<import('mysql2/promise').Pool>;
  private readyPromise: Promise<void>;

  /**
   * Create a new LogDatabase instance.
   * @param dbName Optional database name (not used, for compatibility)
   */
  constructor(dbName?: string) {
    const options = dbName ? { database: dbName } : {};
    this.poolPromise = createDatabasePool(options);
    this.readyPromise = this._initializeDatabase();
  }

  /**
   * Initialize the database: create logs table if not exists.
   * @private
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
   * Add or update a log entry in the database.
   * @param log Log entry object.
   */
  async addLog<T = any>({ id, data, message, timestamp = undefined }: LogEntry<T>) {
    await this.readyPromise;
    const pool = await this.poolPromise;
    if (!timestamp) timestamp = getJakartaTimestamp();
    await pool.query(`REPLACE INTO logs (id, data, message, timestamp) VALUES (?, ?, ?, ?)`, [
      id,
      JSON.stringify(data),
      message,
      timestamp
    ]);
  }

  /**
   * Remove a log entry by its id.
   * @param id Unique log identifier.
   * @returns True if a log was removed, false otherwise.
   */
  async removeLog(id: LogEntry<any>['id']): Promise<boolean> {
    await this.readyPromise;
    const pool = await this.poolPromise;
    const [result]: any = await pool.query('DELETE FROM logs WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }

  /**
   * Get a log entry by its id.
   * @param id Unique log identifier.
   * @returns Log object or undefined if not found.
   */
  async getLogById<T = any>(id: LogEntry<any>['id']): Promise<LogEntry<T> | undefined> {
    await this.readyPromise;
    const pool = await this.poolPromise;
    const [rows]: any = await pool.query('SELECT * FROM logs WHERE id = ?', [id]);
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
   * @returns Array of log objects.
   */
  async getLogs<T = any>(
    filterFn?: (log: LogEntry<T>) => boolean | Promise<boolean>,
    options?: { limit?: number; offset?: number }
  ): Promise<T[]> {
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
    const [rows]: any = await pool.query(query, params);
    const logsArr = rows.map((row: any) => ({
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

  public async waitReady() {
    return await this.readyPromise;
  }

  async close() {
    await this.readyPromise;
    const pool = await this.poolPromise;
    await pool.end();
  }
}
