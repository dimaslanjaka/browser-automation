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

/**
 * Navigates to the skrining page and initiates the process to add a new skrining entry.
 * This function first goes to the main skrining page, waits for and clicks the "Add" button,
 * then optionally navigates to the add skrining form page.
 *
 * @param {import('puppeteer').Page} page - The Puppeteer page instance to navigate
 * @param {boolean} [replacePage=true] - Whether to navigate to the add skrining form page after clicking the add button
 * @returns {Promise<void>} A promise that resolves when navigation is complete
 * @throws {Error} If navigation fails or required elements are not found within the timeout period
 */
export async function enterSkriningPage(page, replacePage = true) {
  await page.goto('https://sumatera.sitb.id/sitb2024/skrining', {
    waitUntil: 'networkidle2',
    timeout: 120000
  });

  await page.waitForSelector('#btnAdd_ta_skrining', { visible: true });
  await page.click('#btnAdd_ta_skrining');

  if (replacePage) {
    await page.goto('https://sumatera.sitb.id/sitb2024/Skrining/add', {
      waitUntil: 'networkidle2',
      timeout: 120000
    });
  }
}
