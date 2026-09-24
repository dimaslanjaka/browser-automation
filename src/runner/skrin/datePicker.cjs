'use strict';

var moment = require('moment');
var date = require('../../utils/date.cjs');
var browser = require('../../utils/browser.cjs');
var isInvalidAlertVisible = require('./isInvalidAlertVisible.cjs');

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
async function selectDateWithUI(page, dateValue, options) {
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
        }
        catch {
            // ignore if CDP not available or unsupported
        }
        await page.evaluate(() => {
            try {
                window.focus();
            }
            catch {
                //
            }
        });
    }
    catch {
        //
    }
    await browser.sleep(200);
    // Use the shared parseDate utility to normalize the incoming string,
    // then create a Moment instance for all later transformations.
    const formatted = date.dateStringToDDMMYYYY(dateValue);
    const parsedMoment = moment(formatted, 'DD/MM/YYYY', true);
    if (!parsedMoment.isValid()) {
        throw new Error(`Invalid dateValue after parsing: ${dateValue}`);
    }
    // click matching date value in datepicker, e.g. <a tabindex="-1" class="k-link" href="#" data-value="2026/4/9" title="Saturday, May 09, 2026">9</a>
    // Build the title strings the calendar may render depending on locale.
    const titleCandidates = [
        parsedMoment.locale('id').format('DD MMMM YYYY'),
        parsedMoment.locale('en').format('dddd, MMMM DD, YYYY')
    ];
    // Build the Kendo data-value selector from the parsed year/month/day.
    const dataValueSelector = `[data-value="${parsedMoment.year()}/${parsedMoment.month()}/${parsedMoment.date()}"]`;
    // small pause to allow UI to settle before selecting date
    await browser.sleep(100);
    // Try localized title selectors first, then fall back to the stable data-value selector.
    const selectorCandidates = [...titleCandidates.map((title) => `[title="${title}"]`), dataValueSelector];
    let selectedSelector = null;
    for (const selector of selectorCandidates) {
        // Probe the DOM so we only click the selector that actually exists on this calendar.
        const match = await page.$(selector);
        if (match) {
            selectedSelector = selector;
            break;
        }
    }
    if (!selectedSelector) {
        throw new Error(`Unable to find datepicker cell for ${dateValue}. Tried: ${selectorCandidates.join(', ')}`);
    }
    console.log('Date selector:', selectedSelector);
    await page.waitForSelector(selectedSelector, { visible: true, timeout: 5000 });
    try {
        await page.$eval(selectedSelector, (el) => el.scrollIntoView({ block: 'center' }));
    }
    catch {
        // ignore scroll failure
    }
    try {
        await page.click(selectedSelector);
    }
    catch {
        // fallback: run a DOM click if puppeteer's click fails
        await page.$eval(selectedSelector, (el) => el.click());
    }
    const invalidAlert = await isInvalidAlertVisible.isInvalidAlertVisible(page);
    if (invalidAlert.result) {
        console.warn('⚠️ Invalid alert detected after selecting date:');
        console.warn(`  ${invalidAlert.contents.join(' - ')}`);
        throw new Error('Invalid alert appeared after selecting date');
    }
}
/**
 * Set the datepicker value programmatically (no UI interaction). Tries Kendo API first, falls back to input value + events.
 * @param page
 * @param dateValue
 */
async function setDatepickerValue(page, dateValue) {
    // Parse and validate the raw date string before writing anything into the input.
    const parsedDate = moment(dateValue, 'DD/MM/YYYY', true);
    if (!parsedDate.isValid()) {
        throw new Error(`Invalid dateValue for datepicker: ${dateValue}`);
    }
    // Reuse the parsed date both as a Date object for Kendo and as a safe fallback string.
    const dateObject = parsedDate.toDate();
    const formattedDate = parsedDate.format('DD/MM/YYYY');
    await page.evaluate((sel, dateObj, fallbackValue) => {
        // Resolve the datepicker input element inside the page context.
        const el = document.querySelector(sel);
        // Reuse jQuery/Kendo if the widget is available on the page.
        const $ = window.jQuery;
        const kendo = window.kendo;
        try {
            if ($ && $.fn && $.fn.kendoDatePicker && el) {
                // Align the widget format with DD/MM/YYYY before writing the parsed Date value.
                const widget = $(el).data('kendoDatePicker');
                if (widget) {
                    if (kendo && typeof kendo.culture === 'function') {
                        try {
                            kendo.culture('id-ID');
                        }
                        catch {
                            // ignore if the culture pack is not available
                        }
                    }
                    if (typeof widget.setOptions === 'function') {
                        widget.setOptions({ format: 'dd/MM/yyyy' });
                    }
                    else if (widget.options) {
                        widget.options.format = 'dd/MM/yyyy';
                    }
                    widget.value(dateObj);
                    if (typeof widget.trigger === 'function')
                        widget.trigger('change');
                    return;
                }
            }
        }
        catch {
            // fall through to plain input fallback
        }
        if (el) {
            // Fallback path for non-Kendo cases: write the normalized string and emit input/change events.
            if (typeof el.removeAttribute === 'function')
                el.removeAttribute('readonly');
            el.value = fallbackValue;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            if (typeof el.setAttribute === 'function')
                el.setAttribute('readonly', 'true');
        }
    }, '#dt_tgl_skrining', dateObject, formattedDate);
}

exports.selectDateWithUI = selectDateWithUI;
exports.setDatepickerValue = setDatepickerValue;
