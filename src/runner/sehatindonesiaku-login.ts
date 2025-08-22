import { getPuppeteer } from '../puppeteer_utils.js';
import { _login } from './sehatindonesiaku-utils.js';

// Script to manual login

async function main() {
  const { page } = await getPuppeteer();
  await page.goto('https://sehatindonesiaku.kemkes.go.id/auth/login', { waitUntil: 'networkidle2' });
  await _login(page);
}

main();
