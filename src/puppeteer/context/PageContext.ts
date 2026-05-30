import type { Browser, Frame, JSHandle, KeyInput, Page, WaitForSelectorOptions } from 'puppeteer';

export type PuppeteerContext = Page | Frame;

/**
 * A wrapper around Puppeteer's Page or Frame that provides a consistent API for common operations,
 * regardless of whether the underlying context is a Page or a Frame. This allows the rest of the codebase
 * to interact with a single PageContext type without worrying about the specific Puppeteer context type.
 */
export class PageContext {
  constructor(
    private readonly context: PuppeteerContext,
    private readonly rootPage?: Page
  ) {}

  static fromPage(page: Page): PageContext {
    return new PageContext(page, page);
  }

  static fromFrame(frame: Frame, page?: Page): PageContext {
    return new PageContext(frame, page);
  }

  get raw(): PuppeteerContext {
    return this.context;
  }

  get page(): Page | undefined {
    return this.rootPage;
  }

  async waitForSelector(selector: string, options?: WaitForSelectorOptions) {
    return this.context.waitForSelector(selector, options);
  }

  async $(selector: string) {
    return this.context.$(selector);
  }

  async $$(selector: string) {
    return this.context.$$(selector);
  }

  async $eval<Selector extends string, Params extends unknown[], Func extends (...args: any[]) => any>(
    selector: Selector,
    pageFunction: Func,
    ...args: Params
  ) {
    return this.context.$eval(selector, pageFunction as any, ...args);
  }

  async $$eval<Selector extends string, Params extends unknown[], Func extends (...args: any[]) => any>(
    selector: Selector,
    pageFunction: Func,
    ...args: Params
  ) {
    return this.context.$$eval(selector, pageFunction as any, ...args);
  }

  async click(selector: string, options?: any) {
    return this.context.click(selector, options);
  }

  async focus(selector: string) {
    return this.context.focus(selector);
  }

  async hover(selector: string) {
    return this.context.hover(selector);
  }

  async tap(selector: string) {
    return this.context.tap(selector);
  }

  async type(selector: string, text: string, options?: { delay?: number }) {
    return this.context.type(selector, text, options);
  }

  async evaluate<Params extends unknown[], Func extends (...args: any[]) => any>(pageFunction: Func, ...args: Params) {
    return this.context.evaluate(pageFunction as any, ...args);
  }

  async evaluateHandle<Params extends unknown[], Func extends (...args: any[]) => any>(
    pageFunction: Func,
    ...args: Params
  ): Promise<JSHandle> {
    return this.context.evaluateHandle(pageFunction as any, ...args);
  }

  async waitForFunction<Params extends unknown[], Func extends (...args: any[]) => any>(
    pageFunction: Func,
    options?: any,
    ...args: Params
  ) {
    return this.context.waitForFunction(pageFunction as any, options, ...args);
  }

  async waitForTimeout(ms: number) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  async content() {
    return this.context.content();
  }

  async title() {
    return this.context.title();
  }

  url() {
    return this.context.url();
  }

  locator(selector: string) {
    return this.context.locator(selector);
  }

  async select(selector: string, ...values: string[]) {
    return this.context.select(selector, ...values);
  }

  async xpath(xpath: string) {
    return this.context.$(`xpath/${xpath}`);
  }

  async exists(selector: string): Promise<boolean> {
    return (await this.context.$(selector)) !== null;
  }

  async visible(selector: string): Promise<boolean> {
    const handle = await this.context.$(selector);

    if (!handle) return false;

    return await handle.evaluate((el) => {
      const style = window.getComputedStyle(el);

      return style.display !== 'none' && style.visibility !== 'hidden' && (el as HTMLElement).offsetParent !== null;
    });
  }

  async scrollIntoView(selector: string) {
    await this.context.$eval(selector, (el) =>
      el.scrollIntoView({
        behavior: 'instant',
        block: 'center'
      })
    );
  }

  async getValue(selector: string) {
    return this.context.$eval(selector, (el) => (el as HTMLInputElement).value);
  }

  async getText(selector: string) {
    return this.context.$eval(selector, (el) => el.textContent ?? '');
  }

  keyboard() {
    if ('keyboard' in this.context) {
      return this.context.keyboard;
    }

    return this.rootPage?.keyboard;
  }

  mouse() {
    if ('mouse' in this.context) {
      return this.context.mouse;
    }

    return this.rootPage?.mouse;
  }

  async press(key: KeyInput) {
    const keyboard = this.keyboard();

    if (!keyboard) {
      throw new Error('Keyboard not available');
    }

    await keyboard.press(key);
  }

  browser(): Browser | undefined {
    if ('browser' in this.context) {
      return this.context.browser();
    }

    return this.rootPage?.browser();
  }
}
