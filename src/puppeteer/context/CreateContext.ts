import type { Page } from 'puppeteer';
import { PageContext } from './PageContext.js';

/**
 * Creates a PageContext for the given page and optional iframe selector.
 * @param page The Puppeteer Page instance to create the context from.
 * @param iframeSelector Optional CSS selector for an iframe within the page. If provided, the context will be created for the iframe's content frame instead of the main page.
 * @returns A Promise that resolves to a PageContext instance representing either the main page or the specified iframe context.
 * @throws Will throw an error if the iframe selector is provided but the iframe cannot be accessed.
 *
 * @example
 *  const ctx = await createContext(page, '#skrining-frame');
    await ctx.waitForSelector('#nik');
    await ctx.type('#nik', nik);
    await ctx.press('Tab');
    const name = await ctx.getValue(
      'input[name="nama_peserta"]'
    );
    const visible = await ctx.visible('#save');
    await ctx.click('#save');
 */
export async function createContext(page: Page, iframeSelector?: string): Promise<PageContext> {
  if (!iframeSelector) {
    return PageContext.fromPage(page);
  }

  const iframe = await page.waitForSelector(iframeSelector);

  const frame = await iframe?.contentFrame();

  if (!frame) {
    throw new Error(`Unable to access iframe: ${iframeSelector}`);
  }

  return PageContext.fromFrame(frame, page);
}
