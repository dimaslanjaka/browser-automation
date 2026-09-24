'use strict';

/**
 * A wrapper around Puppeteer's Page or Frame that provides a consistent API for common operations,
 * regardless of whether the underlying context is a Page or a Frame. This allows the rest of the codebase
 * to interact with a single PageContext type without worrying about the specific Puppeteer context type.
 */
class PageContext {
    context;
    rootPage;
    constructor(context, rootPage) {
        this.context = context;
        this.rootPage = rootPage;
    }
    static fromPage(page) {
        return new PageContext(page, page);
    }
    static fromFrame(frame, page) {
        return new PageContext(frame, page);
    }
    get raw() {
        return this.context;
    }
    get page() {
        return this.rootPage;
    }
    async waitForSelector(selector, options) {
        return this.context.waitForSelector(selector, options);
    }
    async $(selector) {
        return this.context.$(selector);
    }
    async $$(selector) {
        return this.context.$$(selector);
    }
    async $eval(selector, pageFunction, ...args) {
        return this.context.$eval(selector, pageFunction, ...args);
    }
    async $$eval(selector, pageFunction, ...args) {
        return this.context.$$eval(selector, pageFunction, ...args);
    }
    async click(selector, options) {
        return this.context.click(selector, options);
    }
    async focus(selector) {
        return this.context.focus(selector);
    }
    async hover(selector) {
        return this.context.hover(selector);
    }
    async tap(selector) {
        return this.context.tap(selector);
    }
    async type(selector, text, options) {
        return this.context.type(selector, text, options);
    }
    async evaluate(pageFunction, ...args) {
        return this.context.evaluate(pageFunction, ...args);
    }
    async evaluateHandle(pageFunction, ...args) {
        return this.context.evaluateHandle(pageFunction, ...args);
    }
    async waitForFunction(pageFunction, options, ...args) {
        return this.context.waitForFunction(pageFunction, options, ...args);
    }
    async waitForTimeout(ms) {
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
    locator(selector) {
        return this.context.locator(selector);
    }
    async select(selector, ...values) {
        return this.context.select(selector, ...values);
    }
    async xpath(xpath) {
        return this.context.$(`xpath/${xpath}`);
    }
    async exists(selector) {
        return (await this.context.$(selector)) !== null;
    }
    async visible(selector) {
        const handle = await this.context.$(selector);
        if (!handle)
            return false;
        return await handle.evaluate((el) => {
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetParent !== null;
        });
    }
    async scrollIntoView(selector) {
        await this.context.$eval(selector, (el) => el.scrollIntoView({
            behavior: 'instant',
            block: 'center'
        }));
    }
    async getValue(selector) {
        return this.context.$eval(selector, (el) => el.value);
    }
    async getText(selector) {
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
    async press(key) {
        const keyboard = this.keyboard();
        if (!keyboard) {
            throw new Error('Keyboard not available');
        }
        await keyboard.press(key);
    }
    browser() {
        if ('browser' in this.context) {
            return this.context.browser();
        }
        return this.rootPage?.browser();
    }
}

exports.PageContext = PageContext;
