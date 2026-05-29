import { delay } from 'sbg-utility';
import goWithRetry from './puppeteer/goWithRetry.js';
import { waitForDomStable, isElementVisible } from './puppeteer_utils.js';
import { waitEnter } from './utils.js';

/**
 * Logs into the skrining web application using provided credentials.
 *
 * @param {import('puppeteer').Page} page - The Puppeteer page instance to perform login on
 * @returns {Promise<void>} A promise that resolves when login is successful
 * @throws {Error} If login fails or required environment variables are missing
 */
export async function skrinLogin(page) {
  // Always go to login page and do login
  await goWithRetry(page, 'https://sumatera.sitb.id/sitb2024/app/login', { waitUntil: 'networkidle2' });
  // Wait for username and password fields to be visible
  await page.waitForSelector('input[name="username"]', { visible: true });
  await page.waitForSelector('input[name="password"]', { visible: true });
  // Focus, clear, and type username
  await page.focus('input[name="username"]');
  await page.evaluate(() => {
    const el = document.querySelector('input[name="username"]');
    if (el) el.value = '';
  });
  await page.type('input[name="username"]', process.env.skrin_username, { delay: 50 });
  // Focus, clear, and type password
  await page.focus('input[name="password"]');
  await page.evaluate(() => {
    const el = document.querySelector('input[name="password"]');
    if (el) el.value = '';
  });
  await page.type('input[name="password"]', process.env.skrin_password, { delay: 50 });
  // Wait a short moment to ensure values are registered
  await delay(500);
  // If CAPTCHA image exists and is visible, skip automatic submit to allow manual solving
  try {
    const captchaSelector = '#gambar-captcha';
    if (await isElementVisible(page, captchaSelector)) {
      console.warn('CAPTCHA detected on login page; skipping automatic submit.');
      return { result: false, reason: 'captcha_visible' };
    }
  } catch (_err) {
    // ignore errors from visibility check and proceed with submit
  }
  await Promise.all([page.click('button[type="submit"]'), page.waitForNavigation({ waitUntil: 'networkidle2' })]);
  // After login, check if login form is still present (login failed)
  await waitForDomStable(page, 2000, 10000);
  const loginFormSelector = 'input[name="username"]';
  const loginFormEl = await page.$(loginFormSelector);
  if (loginFormEl) {
    return { result: false, reason: 'login_form_present' };
  }
  // Optionally, check for a known post-login element here if needed
  console.log('Login successful');
  return { result: true, reason: 'success' };
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
  await goWithRetry(page, 'https://sumatera.sitb.id/sitb2024/skrining', {
    waitUntil: 'networkidle2',
    timeout: 120000
  });

  await waitForDomStable(page, 3000, 30000);

  await page.waitForSelector('#btnAdd_ta_skrining', { visible: true });
  await page.click('#btnAdd_ta_skrining');

  if (replacePage) {
    await goWithRetry(page, 'https://sumatera.sitb.id/sitb2024/Skrining/add', {
      waitUntil: 'networkidle2',
      timeout: 120000
    });
  }

  await waitForDomStable(page, 3000, 30000);
}

/**
 * Automatically logs in and navigates to the skrining page, ensuring that the page is fully loaded and stable before proceeding.
 * @param {import('puppeteer').Page} page
 */
export async function autoLoginAndEnterSkriningPage(page) {
  if (typeof page?.isClosed === 'function' && page.isClosed()) {
    throw new Error('Cannot focus selected tab because the page is already closed.');
  }
  await page.bringToFront();
  await goWithRetry(page, 'https://sumatera.sitb.id/sitb2024/skrining', { waitUntil: 'networkidle2', timeout: 120000 });
  await waitForDomStable(page, 3000, 30000);

  // Only check for session expired on skrining page
  const sessionExpiredSelector = '.navbar-template.text-left p';
  const sessionMessagePattern =
    /(?:maaf\s+session\s+anda\s+telah\s+habis\s+silahkan\s+login\s+kembali|anda\s+tidak\s+mempunyai\s+kewenangan\s+untuk\s+mengakses\s+halaman\s+ini|expired)/i;
  let sessionExpired = false;
  let sessionText = '';
  const currentUrl = await page.url();
  if (currentUrl.includes('/skrining')) {
    const sessionExpiredElement = await page.$(sessionExpiredSelector);
    if (sessionExpiredElement) {
      sessionText = await page.evaluate((element) => element.textContent?.trim() ?? '', sessionExpiredElement);
      if (sessionMessagePattern.test(sessionText)) {
        sessionExpired = true;
      }
    }
  }
  if (sessionExpired) {
    console.log('Session expired detected. Re-login required.');

    // Try to login once. If CAPTCHA appears, wait for manual solve and check for success
    const { result: firstResult, reason: firstReason } = await skrinLogin(page);
    if (!firstResult) {
      if (firstReason === 'captcha_visible') {
        let attempts = 0;
        let solved = false;
        while (attempts < 5) {
          attempts++;
          await waitEnter('CAPTCHA detected. Please solve it in the browser, then press Enter to continue...');

          // After user indicates they've attempted to solve CAPTCHA, check for welcome panel
          try {
            const welcomeEl = await page.$('.panel.panel-primary');
            if (welcomeEl) {
              const welcomeText = await page.evaluate((el) => el.innerText || '', welcomeEl);
              if (/SELAMAT\s+DATANG\s+DI\s+SISTEM\s+INFORMASI\s+TUBERKULOSIS/i.test(welcomeText)) {
                console.log('Detected SITB welcome panel — treating as logged in.');
                solved = true;
                break;
              }
            }

            // Also accept if login form is no longer present (meaning login succeeded)
            const loginFormEl2 = await page.$('input[name="username"]');
            if (!loginFormEl2) {
              console.log('Login form no longer present — treating as logged in.');
              solved = true;
              break;
            }
          } catch (_err) {
            // ignore and retry
          }
        }
        if (!solved) {
          throw new Error('Login failed: CAPTCHA not solved after multiple attempts.');
        }
      } else {
        throw new Error(`Login failed: ${firstReason || 'unknown'}`);
      }
    }
    // After login, re-enter skrining page and recheck
    await goWithRetry(page, 'https://sumatera.sitb.id/sitb2024/skrining', {
      waitUntil: 'networkidle2',
      timeout: 120000
    });
    await waitForDomStable(page, 3000, 30000);
    const urlAfterLogin = await page.url();
    if (urlAfterLogin.includes('/skrining')) {
      const sessionExpiredElement2 = await page.$(sessionExpiredSelector);
      let sessionText2 = '';
      if (sessionExpiredElement2) {
        sessionText2 = await page.evaluate((element) => element.textContent?.trim() ?? '', sessionExpiredElement2);
        if (sessionMessagePattern.test(sessionText2)) {
          throw new Error('Login failed: session expired message still present after login.');
        }
      }
    }
  }
  await enterSkriningPage(page);
}
