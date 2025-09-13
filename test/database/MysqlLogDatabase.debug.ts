import { MysqlLogDatabase } from '../../src/database/MysqlLogDatabase.js';
import 'dotenv/config';

const { MYSQL_HOST, MYSQL_USER, MYSQL_PASS, MYSQL_PORT } = process.env;

async function main() {
  const db = new MysqlLogDatabase('browser_automation_test', {
    user: MYSQL_USER,
    password: MYSQL_PASS,
    host: MYSQL_HOST,
    port: MYSQL_PORT ? parseInt(MYSQL_PORT, 10) : undefined
  });
  await db.waitReady();

  const log = { id: 'log1', data: { foo: 'bar' }, message: 'Test log' };
  await db.addLog(log);
  const result = await db.getLogById('log1');
  console.log('Retrieved log:', result);

  // Clean up
  await db.removeLog('log1');
  await db.close();
}

main()
  .catch(console.error)
  .finally(() => process.exit(0));
