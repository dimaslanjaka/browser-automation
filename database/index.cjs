'use strict';

var LogDatabase = require('../src/database/LogDatabase.cjs');
var MysqlLogDatabase = require('../src/database/MysqlLogDatabase.cjs');
var SQLiteLogDatabase = require('../src/database/SQLiteLogDatabase.cjs');
var db_utils = require('../src/database/db_utils.cjs');
var MySQLHelper = require('../src/database/MySQLHelper.cjs');



exports.LogDatabase = LogDatabase.LogDatabase;
exports.MysqlLogDatabase = MysqlLogDatabase.MysqlLogDatabase;
exports.mysqlDefaultOptions = MysqlLogDatabase.defaultOptions;
exports.SQLiteLogDatabase = SQLiteLogDatabase.SQLiteLogDatabase;
exports.getDatabaseFilePath = SQLiteLogDatabase.getDatabaseFilePath;
exports.toValidMySQLDatabaseName = db_utils.toValidMySQLDatabaseName;
exports.MySQLHelper = MySQLHelper.MySQLHelper;
