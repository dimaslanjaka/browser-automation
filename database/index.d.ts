import { SharedPreferences } from 'sbg-utility';
import { PoolConnection } from 'mariadb';
import * as better_sqlite3 from 'better-sqlite3';

interface LogEntry<T> {
    id: string | number;
    data: T;
    message: string;
    timestamp?: string;
}
interface BaseLogDatabase {
    addLog<T = any>(log: LogEntry<T>, options?: {
        timeout?: number;
    }): Promise<void>;
    removeLog(id: LogEntry<any>['id']): Promise<boolean>;
    getLogById<T = any>(id: LogEntry<any>['id']): Promise<LogEntry<T> | undefined>;
    getLogs<T = any>(filterFn?: (log: LogEntry<T>) => boolean | Promise<boolean>, options?: {
        limit?: number;
        offset?: number;
    }): Promise<LogEntry<T>[]>;
    waitReady(): Promise<void>;
    close(): Promise<void> | void;
    isClosed(): boolean | Promise<boolean>;
}

interface MySQLConfig {
    host: string;
    user: string;
    password: string;
    database: string;
    port?: number | string;
    connectionLimit?: number;
    connectTimeout?: number;
}
declare class MySQLHelper {
    private pool?;
    private config;
    ready: boolean;
    private initializing?;
    constructor(config: MySQLConfig);
    initialize(): Promise<void>;
    private ensureInitialized;
    private _ensureDatabase;
    /**
     * Execute a simple query
     */
    query<T = any>(sql: string, params?: any[]): Promise<T[]>;
    /**
     * Execute insert/update/delete
     */
    execute(sql: string, params?: any[]): Promise<{
        affectedRows: number;
        insertId?: number;
    }>;
    /**
     * Transaction wrapper
     */
    transaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T>;
    /**
     * Close the pool
     */
    close(): Promise<void>;
}

declare const defaultOptions: Partial<MySQLConfig>;
/**
 * Options for adding a log entry.
 *
 * @property timeout Optional timeout in milliseconds for the database operation.
 * @property update Optional flag to update an existing log entry if it exists.
 */
interface AddLogOptions {
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
declare class MysqlLogDatabase implements BaseLogDatabase {
    private helper;
    private config;
    private readyPromise?;
    /**
     * Create a new MysqlLogDatabase instance.
     *
     * @param dbName Optional database name (not used, for compatibility)
     * @param options Optional pool options (e.g., connectTimeout)
     */
    constructor(dbName?: string, options?: Partial<MySQLConfig>);
    waitReady(): Promise<void>;
    private ensureReady;
    /**
     * Execute a raw SQL query on the underlying MySQL pool.
     *
     * @param sql The SQL query string.
     * @param params Optional parameters for the query.
     * @returns Promise resolving to the query result.
     */
    query<T>(sql: string, params?: any[]): Promise<T[]>;
    /**
     * Add or update a log entry in the database.
     *
     * @param log Log entry object.
     * @param options Optional query options (e.g., timeout in ms)
     * @returns Promise that resolves when the log is added or updated.
     */
    addLog<T = any>({ id, data, message, timestamp }: LogEntry<T>, options?: AddLogOptions): Promise<void>;
    /**
     * Remove a log entry by its id.
     *
     * @param id Unique log identifier.
     * @returns Promise that resolves to true if a log was removed, false otherwise.
     */
    removeLog(id: LogEntry<any>['id']): Promise<boolean>;
    /**
     * Get a log entry by its id.
     *
     * @param id Unique log identifier.
     * @returns Promise that resolves to the log object or undefined if not found.
     */
    getLogById<T = any>(id: LogEntry<T>['id']): Promise<LogEntry<T> | undefined>;
    /**
     * Get all logs or filtered logs from the database.
     *
     * @param filterFn Optional filter function to apply to each log entry after fetching from the database. Can be async.
     * @param options Optional object with limit and offset for pagination.
     * @returns Promise that resolves to an array of log objects.
     */
    getLogs<T = any>(filterFn?: (log: LogEntry<T>) => boolean | Promise<boolean>, options?: {
        limit?: number;
        offset?: number;
    }): Promise<LogEntry<T>[]>;
    closed: boolean;
    isClosed(): boolean;
    /**
     * Close the database connection pool.
     *
     * @returns Promise that resolves when the pool is closed.
     */
    close(): Promise<void>;
}

/**
 * Get the absolute file path for a SQLite database file by name.
 * @param {string} name - Database filename without extension.
 * @returns {string} Absolute path to the database file.
 */
declare function getDatabaseFilePath(name: string): string;
/**
 * Class representing a log database using SQLite.
 */
declare class SQLiteLogDatabase {
    /**
     * Create a new LogDatabase instance.
     * @param {string} [dbFileName] - Optional database filename without extension. Defaults to environment variable DATABASE_FILENAME or 'default'.
     */
    constructor(dbFileName?: string);
    /** @type {string} */
    dbPath: string;
    /** @type {import('better-sqlite3').Database | undefined} */
    db: better_sqlite3.Database | undefined;
    /**
     * Execute a raw SQL query on the underlying SQLite database.
     * @param {string} sql - The SQL query string.
     * @param {any[]} [params] - Optional parameters for the query.
     * @returns {any} The result of the query.
     */
    query(sql: string, params?: any[]): any;
    /**
     * Close the database connection.
     */
    close(): void;
    /**
     * Check if the pool is closed.
     * @returns {boolean}
     */
    isClosed(): boolean;
    /**
     * Backup the SQLite database file to a specified destination (raw SQLite file, not SQL dump).
     * Uses better-sqlite3's native backup method for reliability and performance.
     * @param {string} destPath - The destination file path for the backup (will be a binary SQLite file).
     * @returns {Promise<import('better-sqlite3').BackupMetadata>} Resolves when backup is complete.
     */
    backup(destPath: string): Promise<better_sqlite3.BackupMetadata>;
    /**
     * Initialize the database: set journal mode and create logs table if not exists.
     * @private
     */
    private initialize;
    /**
     * Add or update a log entry in the database.
     * @param {import('./BaseLogDatabase').LogEntry} log - Log entry object.
     */
    addLog(log: LogEntry<any>): void;
    /**
     * Remove a log entry by its id.
     * @param {import('./BaseLogDatabase').LogEntry['id']} id - Unique log identifier.
     * @returns {boolean} True if a log was removed, false otherwise.
     */
    removeLog(id: LogEntry<any>["id"]): boolean;
    /**
     * Get a log entry by its id.
     * @param {import('./BaseLogDatabase').LogEntry['id']} id - Unique log identifier.
     * @returns {import('./BaseLogDatabase').LogEntry | undefined} Log object or undefined if not found.
     */
    getLogById(id: LogEntry<any>["id"]): LogEntry<any> | undefined;
    /**
     * Get all logs or filtered logs from the database.
     *
     * @param {(log: import('./BaseLogDatabase').LogEntry) => boolean | Promise<boolean>} [filterFn] Optional filter function to apply to each log entry after fetching from the database.
     * @param {Object} [options] Optional pagination options.
     * @param {number} [options.limit] Maximum number of logs to return.
     * @param {number} [options.offset] Number of logs to skip before starting to collect the result set.
     * @returns {Array<import('./BaseLogDatabase').LogEntry>} Array of log objects with shape: { id, data, message, timestamp }.
     */
    getLogs(filterFn?: (log: LogEntry<any>) => boolean | Promise<boolean>, options?: {
        limit?: number;
        offset?: number;
    }): Array<LogEntry<any>>;
}

type MySQL2Options = Partial<MySQLConfig>;
interface LogDatabaseOptions extends MySQL2Options {
    [key: string]: any;
    type?: 'sqlite' | 'mysql';
}
declare class LogDatabase<TDefault = any> implements BaseLogDatabase {
    options: LogDatabaseOptions;
    dbName: string;
    store: MysqlLogDatabase | SQLiteLogDatabase;
    pref: SharedPreferences;
    sqliteDbPath: string;
    constructor(dbName?: string, options?: LogDatabaseOptions);
    getType(): Promise<{
        optionsType: "sqlite" | "mysql";
        classType: string;
    }>;
    addLog<T = TDefault>(log: LogEntry<T>, options?: {
        timeout?: number;
    }): Promise<void>;
    removeLog(id: LogEntry<TDefault>['id']): Promise<boolean>;
    getLogById<T = TDefault>(id: LogEntry<T>['id']): Promise<LogEntry<T> | undefined>;
    getLogs<T = TDefault>(filterFn?: (log: LogEntry<T>) => boolean | Promise<boolean>, options?: {
        limit?: number;
        offset?: number;
    }): Promise<LogEntry<T>[]>;
    waitReady(): Promise<void>;
    query<T>(sql: string, params?: any[]): Promise<T[]>;
    close(): Promise<void>;
    /**
     * Returns true if the underlying database connection (MySQL/SQLite) is closed.
     */
    isClosed(): boolean;
    initialize(): Promise<void>;
    showProcessList(print?: boolean): Promise<unknown>;
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
    private isChecksumChanged;
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
    migrate(): Promise<void>;
}

/**
 * Converts an input string into a MySQL-compatible database name.
 *
 * Rules applied:
 * - Replaces non-alphanumeric and non-underscore characters with `_`
 * - Removes leading characters until the name starts with a letter
 * - Truncates result to 64 characters
 * - Returns `default` when input is empty or result becomes empty
 *
 * @param name - Source database name.
 * @returns Sanitized database name.
 */
declare function toValidMySQLDatabaseName(name: any): any;

export { LogDatabase, MySQLHelper, MysqlLogDatabase, SQLiteLogDatabase, getDatabaseFilePath, defaultOptions as mysqlDefaultOptions, toValidMySQLDatabaseName };
export type { AddLogOptions, LogDatabaseOptions, MySQLConfig };
