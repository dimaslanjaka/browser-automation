import 'dotenv/config.js';
import fs from 'fs-extra';
import moment from 'moment';
import type { ElementHandle, Page } from 'puppeteer';
import path from 'upath';
import { clearCurrentPageCookies, waitForDomStable } from '../puppeteer_utils.js';

/**
 * Clicks the "Kembali" button on the page.
 *
 * This function searches for all <button> elements and clicks the first one whose text content
 * (case-insensitive) is exactly "kembali". Throws an error if no such button is found.
 *
 * @param page - Puppeteer page instance
 * @throws If the "Kembali" button is not found
 */
export async function clickKembali(page: Page) {
  const buttons = await page.$$('button');

  for (const btn of buttons) {
    const text = await btn.evaluate((el) => {
      let t = el.innerText || '';
      // Remove zero-width characters
      t = t.replace(/[\u200B-\u200D\uFEFF]/g, '');
      // Remove special characters but keep letters, numbers, spaces
      t = t.replace(/[^\p{L}\p{N} ]/gu, '');
      // Collapse multiple spaces and trim
      t = t.replace(/\s+/g, ' ').trim().toLowerCase();
      return t;
    });

    if (text === 'kembali') {
      await btn.click();
      return;
    }
  }

  // Optional: log all button texts for debugging
  // const allTexts = await Promise.all(buttons.map((b) => b.evaluate((el) => el.innerText)));
  // console.log('All button texts:', allTexts);

  throw new Error("❌ 'Kembali' button not found");
}

// Supported Indonesian month labels seen in header
/**
 * Supported Indonesian month labels mapped to their 0-based month index.
 * Used for parsing month names in calendar headers.
 */
const ID_MONTHS: Record<string, number> = {
  jan: 0,
  januari: 0,
  feb: 1,
  februari: 1,
  mar: 2,
  maret: 2,
  apr: 3,
  april: 3,
  mei: 4,
  jun: 5,
  juni: 5,
  jul: 6,
  juli: 6,
  agt: 7,
  agu: 7,
  agust: 7,
  agustus: 7,
  agst: 7,
  sep: 8,
  september: 8,
  okt: 9,
  oktober: 9,
  nov: 10,
  november: 10,
  des: 11,
  desember: 11
};

/**
 * Converts a month label from the calendar header to a 0-based month index.
 * Accepts full or abbreviated Indonesian month names.
 * @param text Month label from header
 * @returns 0-based month index (0 = January)
 * @throws If the label is not recognized
 */
function monthIndexFromHeader(text: string): number {
  const key = text.trim().toLowerCase();
  if (key in ID_MONTHS) return ID_MONTHS[key];
  const short = key.slice(0, 3);
  if (short in ID_MONTHS) return ID_MONTHS[short];
  throw new Error(`Unrecognized month label in header: "${text}"`);
}

export async function selectTodayFromRegistrationTanggalPemeriksaan(page: Page, dateStr: string): Promise<boolean> {
  // Parse day number from dateStr
  const day = moment(dateStr, 'DD/MM/YYYY', true).date().toString();

  const calendarSelector = 'div.shadow-gmail';

  // Search and click, return true if found
  const clicked = await page.$$eval(
    `${calendarSelector} button`,
    (buttons, targetDay) => {
      const btn = buttons.find((b) => b.innerText.trim() === targetDay);
      if (btn) {
        (btn as HTMLElement).click();
        return true;
      }
      return false;
    },
    day
  );

  return clicked;
}

/**
 * Selects a date in the custom calendar widget by navigating to the correct month/year and clicking the day.
 * @param page Puppeteer page instance
 * @param dateStr Date string in DD/MM/YYYY format
 * @throws If the date is invalid, the calendar is not found, or the day is not available
 */
export async function selectCalendar(page: Page, dateStr: string) {
  // Parse with moment, enforce strict DD/MM/YYYY
  const m = moment(dateStr, 'DD/MM/YYYY', true);
  if (!m.isValid()) {
    throw new Error(`Invalid date string: ${dateStr}, expected DD/MM/YYYY`);
  }
  const targetDay = m.date();
  const targetMonth = m.month(); // 0-based
  const targetYear = m.year();

  // Instead of waiting for selector, just sleep for 1 second to allow calendar to render
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 1000)));
  // Now try to get the days grid
  const daysGrid = await page.$('.grid.grid-cols-7.gap-1.mt-2');
  if (!daysGrid) throw new Error('Calendar days grid not found');

  const rootHandle = (await daysGrid.evaluateHandle((el) => el.closest('div.relative'))) as ElementHandle<Element>;
  if (!rootHandle) throw new Error('Calendar root not found');

  /**
   * Reads the current month and year from the calendar header.
   * @param root Calendar root element handle
   * @returns Object with curMonth (0-based) and curYear
   */
  async function readHeader(root: ElementHandle<Element>) {
    const info = await root.$eval(':scope .flex.justify-between', (hdr) => {
      const left = hdr.querySelector('.flex.items-center');
      const btns = left ? Array.from(left.querySelectorAll('button')) : [];
      const monthText = (btns[0]?.textContent || '').trim();
      const yearText = (btns[1]?.textContent || '').trim();
      return { monthText, yearText };
    });
    const curMonth = monthIndexFromHeader(info.monthText);
    const curYear = parseInt(info.yearText, 10);
    return { curMonth, curYear };
  }

  /**
   * Gets the previous and next navigation buttons in the calendar.
   * @param root Calendar root element handle
   * @returns Object with prevBtn and nextBtn element handles
   */
  async function getNavButtons(root: ElementHandle<Element>) {
    const buttons = await root.$$(':scope .flex.items-center.justify-center > button');
    if (buttons.length < 2) throw new Error('Prev/Next buttons not found');
    return { prevBtn: buttons[0], nextBtn: buttons[1] };
  }

  const { prevBtn, nextBtn } = await getNavButtons(rootHandle);

  // Navigate to target month/year
  for (let safety = 0; safety < 600; safety++) {
    const { curMonth, curYear } = await readHeader(rootHandle);
    if (curMonth === targetMonth && curYear === targetYear) break;

    const diff = (targetYear - curYear) * 12 + (targetMonth - curMonth);
    if (diff < 0) {
      await prevBtn.click();
    } else {
      await nextBtn.click();
    }
    await waitForDomStable(page, 150);
    if (safety === 599) throw new Error(`Failed to reach ${targetMonth + 1}/${targetYear}`);
  }

  // Click the day
  const clicked = await rootHandle.evaluate((root, wantedDay: number) => {
    const grid = root.querySelector('.grid.grid-cols-7');
    if (!grid) return false;
    const btns = Array.from(grid.querySelectorAll('button')) as HTMLButtonElement[];
    for (const btn of btns) {
      if (btn.classList.contains('cursor-not-allowed') || btn.disabled) continue;
      const daySpan = btn.querySelector('span.font-bold');
      const txt = daySpan?.textContent?.trim() || '';
      if (Number(txt) === wantedDay) {
        (btn as HTMLElement).click();
        return true;
      }
    }
    return false;
  }, targetDay);

  if (!clicked) {
    console.error(`Day ${targetDay} not found in current month view`);
  }

  return clicked;
}

export async function screenshot(page: Page, filePath: string = 'tmp/screenshot.png') {
  fs.ensureDirSync(path.dirname(filePath));
  await page.screenshot({
    path: filePath as any,
    fullPage: true
  });
  console.log(`Screenshot saved as ${filePath}`);
}

export async function clickDaftarBaru(page: Page) {
  // Use a compatible selector and textContent check since :has and :contains are not supported in querySelector
  const buttonHandle = await page.evaluateHandle(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    return (
      buttons.find((btn) => {
        const div = btn.querySelector('div.text-white');
        return div && div.textContent && div.textContent.trim() === 'Daftar Baru';
      }) || null
    );
  });
  if (buttonHandle) {
    const isVisible = await buttonHandle.evaluate(
      (el) => el !== null && !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)
    );
    if (isVisible) {
      await buttonHandle.click();
      // Wait for dom to stabilize after clicking
      await page.evaluate(async () => {
        function waitForDomStable(timeout = 10000, stableMs = 800) {
          return new Promise((resolve, reject) => {
            let lastChange = Date.now();
            // eslint-disable-next-line prefer-const
            let observer: MutationObserver;
            const timer = setTimeout(() => {
              if (observer) observer.disconnect();
              reject(new Error('DOM did not stabilize in time'));
            }, timeout);
            observer = new MutationObserver(() => {
              lastChange = Date.now();
            });
            observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
            (function check() {
              if (Date.now() - lastChange > stableMs) {
                clearTimeout(timer);
                observer.disconnect();
                resolve(undefined);
              } else {
                setTimeout(check, 100);
              }
            })();
          });
        }
        await waitForDomStable();
      });
    } else {
      console.log('Button exists but is not visible');
    }
  } else {
    throw new Error('Button "Daftar Baru" not found');
  }
}

/**
 * Perform login on the sehatindonesiaku.kemkes.go.id site.
 * @param page Puppeteer page instance
 * @param options Optional login options: username, password, clearCookies
 */
export async function _login(
  page: Page,
  options: {
    username?: string;
    password?: string;
    clearCookies?: boolean;
  } = {}
) {
  const {
    username = process.env.SIH_USERNAME || '',
    password = process.env.SIH_PASSWORD || '',
    clearCookies = false
  } = options;

  await page.goto('https://sehatindonesiaku.kemkes.go.id/auth/login', { waitUntil: 'networkidle2' });

  // Clear cookies if specified
  if (clearCookies) {
    await clearCurrentPageCookies(page);
    await page.goto('https://sehatindonesiaku.kemkes.go.id/auth/login', { waitUntil: 'networkidle2' });
  }

  // Check if already logged in
  if (!page.url().includes('/auth/login')) {
    console.log('Already logged in, skipping login step');
    return;
  }
  // Fill email (username)
  await page.type('input[name="Email"]', username);
  // Fill password
  await page.type('input[name="Kata sandi"]', password);
  // Wait for captcha input to be visible
  await page.waitForSelector('input[name="Captcha"]', { visible: true });
  // Optionally, you can add code to handle captcha here (manual or automated)
  // Uncomment below to prompt for captcha input from user
  // const captcha = await promptUserForCaptcha();
  // await page.type('input[name="Captcha"]', captcha);
  // Wait for the login button to be enabled and click it
  const loginButtonSelector = 'div.text-center .bg-disabled, div.text-center button[type="submit"]';
  // Try to find enabled button, fallback to disabled for waiting
  await page.waitForSelector(loginButtonSelector, { visible: true });
  // If the button is not disabled, click it
  const isDisabled = await page.$eval(loginButtonSelector, (el) => el.classList.contains('bg-disabled'));
  if (!isDisabled) {
    await Promise.all([
      page.click('div.text-center button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' })
    ]);
    console.log('Login successful');
  } else {
    console.log('Login button is disabled. Please check if all fields are filled and captcha is handled.');
  }
}

export async function enterSehatIndonesiaKu(page: Page) {
  await page.goto('https://sehatindonesiaku.kemkes.go.id/ckg-pendaftaran-individu', { waitUntil: 'networkidle2' });

  // Wait for DOM to stabilize (no mutations for 800ms)
  await page.evaluate(async () => {
    function waitForDomStable(timeout = 10000, stableMs = 800) {
      return new Promise((resolve, reject) => {
        let lastChange = Date.now();
        // eslint-disable-next-line prefer-const
        let observer: MutationObserver;
        const timer = setTimeout(() => {
          if (observer) observer.disconnect();
          reject(new Error('DOM did not stabilize in time'));
        }, timeout);
        observer = new MutationObserver(() => {
          lastChange = Date.now();
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
        (function check() {
          if (Date.now() - lastChange > stableMs) {
            clearTimeout(timer);
            observer.disconnect();
            resolve(undefined);
          } else {
            setTimeout(check, 100);
          }
        })();
      });
    }
    await waitForDomStable();
  });

  // Now safe to interact with the DOM

  // Check if current url is not https://sehatindonesiaku.kemkes.go.id/auth/login
  const currentUrl = page.url();
  if (!currentUrl.includes('/login')) {
    return true;
  } else {
    // User is not logged in, perform login
    await _login(page);
    return false;
  }
}
