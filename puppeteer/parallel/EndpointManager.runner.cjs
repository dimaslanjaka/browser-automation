'use strict';

var require$$4 = require('sbg-utility');
var puppeteer_parallel_EndpointManager_connector = require('./EndpointManager.connector.cjs');

async function main() {
    const { browser } = await puppeteer_parallel_EndpointManager_connector.connectEndpoint();
    const goto = async (url, newTab = true) => {
        const page = newTab ? await browser.newPage() : (await browser.pages())[0] || (await browser.newPage());
        await page.goto(url).catch(require$$4.noop);
    };
    goto('https://accounts.google.com/');
    goto('https://www.scrapingcourse.com/antibot-challenge');
    goto('https://bot.sannysoft.com');
}
main().catch((e) => console.error(e));
