import { Page } from 'puppeteer';
import moment from 'moment';
import { sleep } from '../../utils-browser.js';
import { typeAndTrigger } from '../../puppeteer_utils.js';

/**
 * Select a date using the calendar UI by opening the datepicker and clicking the matching day.
 *
 * Behavior:
 * - Opens the Kendo datepicker popup and (by default) navigates months to reach the target month.
 * - Brings the page to the foreground and attempts to restore the OS window (CDP) so clicks register.
 * - Selects the day by its localized `title` attribute (Indonesian format, e.g. "28 Maret 2026").
 *
 * Note: this function intentionally does NOT fall back to the `data-value` attribute selector.
 *
 * @param page Puppeteer `Page` instance
 * @param dateValue Date string in `DD/MM/YYYY` format (e.g. `18/03/2026`)
 * @param options Optional settings
 * @param options.skipMonthNavigation When true, skip clicking month navigation buttons (useful
 *        when the picker already displays the correct month or for testing)
 */
export async function selectDateWithUI(page: Page, dateValue: string, options?: { skipMonthNavigation?: boolean }) {
  console.log('Selecting date with UI:', dateValue);

  // click <span unselectable="on" class="k-select" role="button" aria-controls="dt_tgl_skrining_dateview"><span unselectable="on" class="k-icon k-i-calendar">select</span></span>
  await page.waitForSelector('[aria-controls="dt_tgl_skrining_dateview"]', { visible: true });
  await page.click('[aria-controls="dt_tgl_skrining_dateview"]');
  // wait for the datepicker popup to open (it starts with display:none)
  await page.waitForSelector('#dt_tgl_skrining_dateview', { visible: true, timeout: 5000 });
  // ensure the browser window / page is in foreground so clicks register
  try {
    await page.bringToFront();
    // try to restore/un-minimize the OS window using the DevTools protocol
    try {
      const client = await page.createCDPSession();
      const { windowId } = await client.send('Browser.getWindowForTarget');
      await client.send('Browser.setWindowBounds', { windowId, bounds: { windowState: 'normal' } });
    } catch {
      // ignore if CDP not available or unsupported
    }
    await page.evaluate(() => {
      try {
        window.focus();
      } catch {
        //
      }
    });
  } catch {
    //
  }
  await sleep(200);
  const parseDate = moment(dateValue, 'DD/MM/YYYY');

  if (!options?.skipMonthNavigation) {
    // click previous month button if needed, e.g. <a href="#" role="button" class="k-link k-nav-prev" aria-disabled="false"><span class="k-icon k-i-arrow-w"></span></a>
    // check if dateValue month is before the currently displayed month in datepicker, if so click previous month button until the month is correct
    const dateMonth = parseDate.month();
    const currentMonth = moment().month();
    const totalClickPrev = currentMonth - dateMonth;
    console.log('Date month:', dateMonth, 'Current month:', currentMonth, 'Total click prev:', totalClickPrev);
    // click <a href="#" role="button" class="k-link k-nav-prev" aria-disabled="false"><span class="k-icon k-i-arrow-w"></span></a>
    for (let i = 0; i < totalClickPrev; i++) {
      await page.waitForSelector('.k-link.k-nav-prev', { visible: true });
      try {
        await page.click('.k-link.k-nav-prev');
      } catch {
        // fallback: run a DOM click in page context if puppeteer's click fails
        await page.$eval('.k-link.k-nav-prev', (el) => (el as HTMLElement).click());
      }
      await sleep(500); // wait for the datepicker to update after clicking previous month button
    }
  }

  // click matching date value in datepicker, e.g. <a tabindex="-1" class="k-link" href="#" data-value="2026/3/7" title="07 April 2026">7</a>
  // prefer selecting the day by its title attribute (e.g. "28 Maret 2026")
  const titleStr = parseDate.locale('id').format('DD MMMM YYYY');
  console.log('Title attribute selector:', titleStr);
  // small pause to allow UI to settle before selecting date
  await sleep(100);
  await page.waitForSelector(`[title="${titleStr}"]`, { visible: true, timeout: 5000 });
  try {
    await page.$eval(`[title="${titleStr}"]`, (el) => (el as HTMLElement).scrollIntoView({ block: 'center' }));
  } catch {
    // ignore scroll failure
  }
  try {
    await page.click(`[title="${titleStr}"]`);
  } catch {
    // fallback: run a DOM click if puppeteer's click fails
    await page.$eval(`[title="${titleStr}"]`, (el) => (el as HTMLElement).click());
  }
}

/**
 * Set the datepicker value programmatically (no UI interaction). Tries Kendo API first, falls back to input value + events.
 * @param page
 * @param dateValue
 */
export async function setDatepickerValue(page: Page, dateValue: string) {
  await page.$eval('#dt_tgl_skrining', (el) => el.removeAttribute('readonly'));
  await typeAndTrigger(page, '#dt_tgl_skrining', dateValue);
  await page.$eval('#dt_tgl_skrining', (el) => el.setAttribute('readonly', 'true'));

  await page.evaluate(
    (sel, dateStr) => {
      const el = document.querySelector(sel) as HTMLInputElement | null;
      const $ = (window as any).jQuery;
      const kendo = (window as any).kendo;
      try {
        if ($ && $.fn && $.fn.kendoDatePicker && el) {
          const widget = ($(el) as any).data('kendoDatePicker');
          if (widget) {
            let parsed: Date | null = null;
            if (kendo && typeof kendo.parseDate === 'function') {
              parsed = kendo.parseDate(dateStr, 'dd/MM/yyyy');
            } else {
              const parts = String(dateStr).split('/');
              if (parts.length === 3) parsed = new Date(+parts[2], +parts[1] - 1, +parts[0]);
            }
            widget.value(parsed);
            if (typeof widget.trigger === 'function') widget.trigger('change');
            return;
          }
        }
      } catch {
        // fall through to plain input fallback
      }

      if (el) {
        if (typeof (el as any).removeAttribute === 'function') (el as any).removeAttribute('readonly');
        el.value = dateStr;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof (el as any).setAttribute === 'function') (el as any).setAttribute('readonly', 'true');
      }
    },
    '#dt_tgl_skrining',
    dateValue
  );
}
