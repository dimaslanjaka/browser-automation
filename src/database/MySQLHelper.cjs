'use strict';

var mariadb = require('mariadb');
var fs = require('fs-extra');
var path = require('path');

function _interopNamespaceDefault(e) {
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () { return e[k]; }
                });
            }
        });
    }
    n.default = e;
    return Object.freeze(n);
}

var mariadb__namespace = /*#__PURE__*/_interopNamespaceDefault(mariadb);

class MySQLHelper {
    pool;
    config;
    ready = false;
    initializing;
    constructor(config) {
        this.config = config;
    }
    async initialize() {
        if (this.ready && this.pool)
            return;
        if (this.initializing) {
            await this.initializing;
            return;
        }
        this.initializing = (async () => {
            // Always ensure the database exists.
            // A local schema marker file can become stale if the DB is dropped externally.
            await this._ensureDatabase();
            const _schemaIndicatorFile = path.join(process.cwd(), 'tmp/database/', `${this.config.database}.schema`);
            if (!fs.existsSync(_schemaIndicatorFile)) {
                await fs.ensureDir(path.dirname(_schemaIndicatorFile));
                await fs.writeFile(_schemaIndicatorFile, `Initialized at ${new Date().toISOString()}\n`, 'utf-8');
            }
            // Create connection pool
            this.pool = mariadb__namespace.createPool({
                host: this.config.host,
                user: this.config.user,
                password: this.config.password,
                database: this.config.database,
                port: parseInt(String(this.config.port || 3306), 10),
                connectionLimit: this.config.connectionLimit || 5,
                connectTimeout: this.config.connectTimeout || 60000,
                allowPublicKeyRetrieval: true
            });
            this.ready = true;
        })();
        try {
            await this.initializing;
        }
        finally {
            this.initializing = undefined;
        }
    }
    async ensureInitialized() {
        if (!this.ready || !this.pool) {
            await this.initialize();
        }
    }
    async _ensureDatabase() {
        const adminConn = await mariadb__namespace.createConnection({
            host: this.config.host,
            user: this.config.user,
            password: this.config.password,
            port: parseInt(String(this.config.port ?? '3306'), 10),
            connectTimeout: this.config.connectTimeout || 60000,
            allowPublicKeyRetrieval: true
        });
        await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${this.config.database}\``);
        await adminConn.end();
    }
    /**
     * Execute a simple query
     */
    async query(sql, params = []) {
        await this.ensureInitialized();
        let conn;
        try {
            conn = await this.pool.getConnection();
            const rows = await conn.query(sql, params);
            // Remove metadata property if present
            return Array.isArray(rows) ? rows : [];
        }
        finally {
            if (conn)
                conn.release();
        }
    }
    /**
     * Execute insert/update/delete
     */
    async execute(sql, params = []) {
        await this.ensureInitialized();
        let conn;
        try {
            conn = await this.pool.getConnection();
            const result = await conn.query(sql, params);
            return {
                affectedRows: result.affectedRows || 0,
                insertId: result.insertId || undefined
            };
        }
        finally {
            if (conn)
                conn.release();
        }
    }
    /**
     * Transaction wrapper
     */
    async transaction(fn) {
        await this.ensureInitialized();
        let conn;
        try {
            conn = await this.pool.getConnection();
            await conn.beginTransaction();
            const result = await fn(conn);
            await conn.commit();
            return result;
        }
        catch (err) {
            if (conn)
                await conn.rollback();
            throw err;
        }
        finally {
            if (conn)
                conn.release();
        }
    }
    /**
     * Close the pool
     */
    async close() {
        if (!this.ready || !this.pool)
            return;
        await this.pool.end();
        this.pool = undefined;
        this.ready = false;
    }
}

exports.MySQLHelper = MySQLHelper;
