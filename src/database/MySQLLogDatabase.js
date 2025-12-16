import mariadb from 'mariadb';
import cp from 'cross-spawn';
import fs from 'fs-extra';
import moment from 'moment-timezone';
import { jsonParseWithCircularRefs, jsonStringifyWithCircularRefs } from 'sbg-utility';
import path from 'upath';

const binPath = path.join(process.cwd(), 'bin');

// Shared default MySQL/MariaDB credentials (can be reused by other modules)
export const MYSQL_DEFAULT_CONFIG = {
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT, 10) : 3306,
  user: process.env.MYSQL_USER || 'root',
  // support both MYSQL_PASS and MYSQL_PASSWORD
  password: process.env.MYSQL_PASS || process.env.MYSQL_PASSWORD || '',
  // support both MYSQL_DBNAME and MYSQL_DATABASE
  database: process.env.MYSQL_DBNAME || process.env.MYSQL_DATABASE || undefined,
  connectionLimit: 5
};

/**
 * MySQL / MariaDB backed log database.
 * constructor(tableName, dbNameOrConfig?)
 * - tableName: the table to use (previously called dbfilename in sqlite impl)
 * - dbNameOrConfig: optional string database name or connection config object
 */
export class MySQLLogDatabase {
  constructor(tableName, dbNameOrConfig) {
    if (!tableName) throw new Error('tableName is required');
    this.table = tableName;

    // start from shared default config, allow overrides via dbNameOrConfig
    let config = { ...MYSQL_DEFAULT_CONFIG };
    if (typeof dbNameOrConfig === 'string') {
      config.database = dbNameOrConfig;
    } else if (dbNameOrConfig && typeof dbNameOrConfig === 'object') {
      config = { ...config, ...dbNameOrConfig };
    }

    this.config = config;
    this.pool = mariadb.createPool(config);

    this.initialize().catch((err) => {
      console.error('MySQLLogDatabase initialization failed:', err);
    });
  }

  async query(sql, params = []) {
    const conn = await this.pool.getConnection();
    try {
      const rows = await conn.query(sql, params);
      // mariadb returns an OkPacket for writes; for selects it's an array
      return rows;
    } finally {
      conn.release();
    }
  }

  async initialize() {
    // Ensure database exists (if provided in config)
    if (this.config.database) {
      // create database if not exists
      const tempPool = mariadb.createPool({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        connectionLimit: 1
      });
      const conn = await tempPool.getConnection();
      try {
        await conn.query(`CREATE DATABASE IF NOT EXISTS \`${this.config.database}\``);
      } finally {
        conn.release();
        await tempPool.end();
      }
    }

    // Create table if not exists
    const createSQL = `
      CREATE TABLE IF NOT EXISTS \`${this.table}\` (
        id VARCHAR(255) PRIMARY KEY,
        data TEXT,
        message TEXT,
        timestamp VARCHAR(64)
      ) ENGINE=InnoDB
    `;
    await this.query(createSQL);
  }

  async addLog(log) {
    const timestamp = log.timestamp || moment().tz('Asia/Jakarta').format('YYYY-MM-DDTHH:mm:ssZ');
    const data = jsonStringifyWithCircularRefs(log.data);
    const sql = `INSERT INTO \`${this.table}\` (id, data, message, timestamp) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE data = VALUES(data), message = VALUES(message), timestamp = VALUES(timestamp)`;
    await this.query(sql, [log.id, data, log.message, timestamp]);
  }

  async removeLog(id) {
    const res = await this.query(`DELETE FROM \`${this.table}\` WHERE id = ?`, [id]);
    // res.affectedRows may be present as an OkPacket
    if (res && typeof res.affectedRows === 'number') return res.affectedRows > 0;
    // fallback: if result is an array, no deletions
    return false;
  }

  async getLogById(id) {
    const rows = await this.query(`SELECT * FROM \`${this.table}\` WHERE id = ? LIMIT 1`, [id]);
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!row) return undefined;
    return {
      id: row.id,
      data: jsonParseWithCircularRefs(row.data),
      message: row.message,
      timestamp: row.timestamp
    };
  }

  async getLogs(filterFn = () => true, options = {}) {
    let sql = `SELECT * FROM \`${this.table}\``;
    const params = [];
    if (options?.limit) {
      sql += ' LIMIT ?';
      params.push(options.limit);
      if (options.offset) {
        sql += ' OFFSET ?';
        params.push(options.offset);
      }
    }
    const rows = await this.query(sql, params);
    const logsArr = (rows || []).map((row) => ({
      id: row.id,
      data: jsonParseWithCircularRefs(row.data),
      message: row.message,
      timestamp: row.timestamp
    }));
    // If filterFn is async, handle that case
    if (filterFn.constructor.name === 'AsyncFunction') {
      const results = [];
      for (const l of logsArr) {
        if (await filterFn(l)) results.push(l);
      }
      return results;
    }
    return logsArr.filter(filterFn);
  }

  async backup(destPath) {
    await fs.ensureDir(path.dirname(destPath));
    const env = { ...process.env };
    const pathSep = process.platform === 'win32' ? ';' : ':';
    const extraPaths = [binPath];
    if (process.platform === 'win32') {
      // common locations for mysqldump on Windows (xampp, laragon, default MySQL installs)
      extraPaths.push('C:\\xampp\\mysql\\bin');
      // use current architecture rather than hard-coded x64
      const arch = process.arch;
      extraPaths.push(`C:\\laragon\\bin\\mysql\\mysql-8.4.3-win${arch}\\bin`);
      extraPaths.push('C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin');
      extraPaths.push('C:\\Program Files\\MySQL\\MySQL Server 5.7\\bin');
    }
    env.PATH = extraPaths.join(pathSep) + pathSep + (process.env.PATH || '');
    if (this.config.password) env.MYSQL_PWD = this.config.password;

    const args = ['--single-transaction', '--skip-lock-tables'];
    if (this.config.host) args.push('-h', this.config.host);
    if (this.config.port) args.push('-P', `${this.config.port}`);
    if (this.config.user) args.push('-u', this.config.user);
    // specify database and table
    if (!this.config.database) throw new Error('database must be specified for mysqldump backup');
    args.push(this.config.database, this.table);

    const outStream = fs.createWriteStream(destPath);
    const child = cp('mysqldump', args, { stdio: ['ignore', 'pipe', 'inherit'], env });
    child.stdout.pipe(outStream);
    await new Promise((resolve, reject) => {
      child.on('error', (err) => reject(err));
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`mysqldump exited with code ${code}`));
      });
    });

    // wait until file is accessible
    while (
      await fs
        .access(destPath)
        .then(() => false)
        .catch(() => true)
    ) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      this.pool = undefined;
    }
  }

  isClosed() {
    return !this.pool;
  }
}

// Helper to create instance
export function createMySQLLogDatabase(tableName, dbNameOrConfig) {
  return new MySQLLogDatabase(tableName, dbNameOrConfig);
}

// Default singleton for convenience (if env provided)
let singleton;
// Prefer `MYSQL_TABLE` as the env var for table name. Keep fallback to `DATABASE_FILENAME` for compatibility.
const mysqlTableEnv = process.env.MYSQL_TABLE || process.env.DATABASE_FILENAME;
if (mysqlTableEnv) {
  singleton = new MySQLLogDatabase(mysqlTableEnv, process.env.MYSQL_DBNAME || process.env.MYSQL_DATABASE);
}

export async function backupMySQLLogDatabase(destPath) {
  if (!singleton) throw new Error('No singleton MySQLLogDatabase configured (set MYSQL_TABLE env)');
  return singleton.backup(destPath);
}

export async function addLogToMySQL(params) {
  if (!singleton) throw new Error('No singleton MySQLLogDatabase configured (set MYSQL_TABLE env)');
  return singleton.addLog(params);
}

export async function getLogsFromMySQL(filterFn) {
  if (!singleton) throw new Error('No singleton MySQLLogDatabase configured (set MYSQL_TABLE env)');
  return singleton.getLogs(filterFn);
}
