import 'dotenv/config.js';
import fs from 'fs-extra';
import moment from 'moment';
import type { ElementHandle, Page } from 'puppeteer';
import path from 'upath';
import { waitForDomStable } from '../puppeteer_utils.js';

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

  const daysGrid = await page.waitForSelector('.grid.grid-cols-7.gap-1.mt-2', { visible: true, timeout: 10000 });
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
    const grid = root.querySelector('.grid.grid-cols-7.gap-1.mt-2');
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
    throw new Error(`Day ${targetDay} not found in current month view`);
  }
}

export async function screenshot(page: Page, filePath: string = 'tmp/screenshot.png') {
  fs.ensureDirSync(path.dirname(filePath));
  await page.screenshot({
    path: filePath as any,
    fullPage: true
  });
  console.log(`Screenshot saved as ${filePath}`);
}
