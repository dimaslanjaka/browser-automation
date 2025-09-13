import 'dotenv/config';
import MySQLHelper from '../../src/database/MySQLHelper.js';

const { MYSQL_HOST, MYSQL_USER, MYSQL_PASS, MYSQL_PORT } = process.env;

describe('MySQLHelper', () => {
  let db: MySQLHelper;

  beforeAll(() => {
    // You may need to adjust connection config for your environment
    db = new MySQLHelper({
      host: MYSQL_HOST,
      user: MYSQL_USER,
      password: MYSQL_PASS,
      database: 'browser_automation_test',
      port: MYSQL_PORT ? parseInt(MYSQL_PORT, 10) : undefined
    });
  });

  afterAll(async () => {
    await db.close();
  });

  test('should connect to the database', async () => {
    await expect(db.initialize()).resolves.not.toThrow();
  });

  test('should execute a simple query', async () => {
    const rows = await db.query('SELECT NOW() AS now');
    expect(rows[0]).toHaveProperty('now');
    expect(new Date(rows[0].now)).toBeInstanceOf(Date);
  });

  describe('CRUD operations', () => {
    const table = 'test_table';
    const createTableSQL = `CREATE TABLE IF NOT EXISTS ${table} (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255))`;
    const dropTableSQL = `DROP TABLE IF EXISTS ${table}`;

    beforeAll(async () => {
      await db.initialize();
      await db.execute(createTableSQL);
    });

    afterAll(async () => {
      await db.execute(dropTableSQL);
    });

    let insertedId: number;

    test('should insert a row', async () => {
      const result = await db.execute(`INSERT INTO ${table} (name) VALUES (?)`, ['Alice']);
      expect(result.affectedRows).toBe(1);
      expect(result.insertId).toBeDefined();
      insertedId = result.insertId!;
    });

    test('should read a row', async () => {
      const rows = await db.query(`SELECT * FROM ${table} WHERE id = ?`, [insertedId]);
      expect(rows.length).toBe(1);
      expect(rows[0].name).toBe('Alice');
    });

    test('should update a row', async () => {
      const result = await db.execute(`UPDATE ${table} SET name = ? WHERE id = ?`, ['Bob', insertedId]);
      expect(result.affectedRows).toBe(1);
      const rows = await db.query(`SELECT * FROM ${table} WHERE id = ?`, [insertedId]);
      expect(rows[0].name).toBe('Bob');
    });

    test('should delete a row', async () => {
      const result = await db.execute(`DELETE FROM ${table} WHERE id = ?`, [insertedId]);
      expect(result.affectedRows).toBe(1);
      const rows = await db.query(`SELECT * FROM ${table} WHERE id = ?`, [insertedId]);
      expect(rows.length).toBe(0);
    });
  });

  test('should close the database connection', async () => {
    await expect(db.close()).resolves.not.toThrow();
    expect(db.ready).toBe(false);
  });
});
