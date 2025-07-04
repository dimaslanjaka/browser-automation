/**
 * Logs into the skrining web application using provided credentials.
 *
 * @param {import('puppeteer').Page} page - The Puppeteer page instance to perform login on
 * @returns {Promise<void>} A promise that resolves when login is successful
 * @throws {Error} If login fails or required environment variables are missing
 */
export async function skrinLogin(page) {
  await page.goto('https://sumatera.sitb.id/sitb2024/app', { waitUntil: 'networkidle2' });
  await page.type('input[name="username"]', process.env.skrin_username);
  await page.type('input[name="password"]', process.env.skrin_password);
  await Promise.all([page.click('button[type="submit"]'), page.waitForNavigation({ waitUntil: 'networkidle2' })]);
  console.log('Login successful');
}
